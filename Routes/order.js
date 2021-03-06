const express = require('express');
const router = express.Router();
const auth = require('../middleware/oauth');
const nodemailer = require('nodemailer');
const moment = require('moment');
const path = require('path');
const Email = require('email-templates');

const Order = require('../Models/Order');
const Voucher = require('../Models/Voucher');
const User = require('../Models/User');
const Bar = require('../Models/Bar');

const {default: HTMLToPDF} = require('convert-html-to-pdf');

const {htmlToPdf, responseCodes, getVoucherData, verifyOrder} = require('../utils');

const emailRender = new Email({
    juice: true,
    juiceResources: {
        preserveImportant: true,
        webResources: {
            relativeTo: path.resolve('emails')
        }
    },
});

const getVoucherHTML = (options) => {
    return emailRender.render('voucher/html', options)
};


// @route       POST/User
// @desc        Make new order
// access       Private

router.post('/34***##', async (req, res) => {

    let {reference, userId, vouchers, isGuest = false, guestData} = req.body;

    //Calculate the total price of the order
    const ordersTotal = vouchers.reduce((currentTotal, {price, quantity}) => currentTotal + (price * quantity), 0);

    //Verify reference using https://api.paystack.co/transaction/verify/refId
    let paystackData;
    try{
        paystackData = await verifyOrder(reference)
        //If invalid reference then order is invalid
        if(!paystackData.status){
            return res.status(400).json({
                message: 'Order not valid',
                code: responseCodes.INVALID_ORDER
            })
        }

        const paystackVouchers = paystackData.data.metadata.vouchers
        //If vouchers in metadata don't match orders sent then it's invalid
        if(JSON.stringify(paystackVouchers) !== JSON.stringify(vouchers)){
            return res.status(400).json({
                message: 'Order not valid',
                code: responseCodes.INVALID_ORDER
            })
        }

        //If amount in paystack data doesn't match order then it's invalid (*100 is to convert to kobo)
        if(paystackData.data.amount !== (ordersTotal * 100)){
            return res.status(400).json({
                message: 'Order not valid',
                code: responseCodes.INVALID_ORDER
            })
        }

        //If an order with that reference already exists then it's invalid
        const prevOrder = await Order.findOne({reference})
        if(prevOrder){
            return res.status(400).json({
                message: 'Order not valid',
                code: responseCodes.INVALID_ORDER
            })
        }
    }catch (e) {
        return res.status(400).json({
            message: 'Order not valid',
            code: responseCodes.INVALID_ORDER
        })
    }

    try {
        //If greater than 45000 reject the order
        if (ordersTotal > 45000) {
            return res.status(400).json({
                success: false,
                message: 'Orders should not be more than 9000',
                code: responseCodes.ORDER_REACHED_LIMIT
            })
        }

        let user;

        if(!isGuest){
            user = await User.findById(userId);
            //If user not found return error
            if(!user){
                return res.status(404).json({
                    success: false,
                    message: 'User not found',
                    code: responseCodes.USER_NOT_FOUND
                })
            }

            //If user has used max vouchers reject
            if(user.vouchersUsed >= 15){
                return res.status(400).json({
                    success: false,
                    message: 'User has bought max vouchers',
                    code: responseCodes.VOUCHER_REACHED_LIMIT
                })
            }

            const today = moment().endOf('day');
            const lastWeek = moment().subtract(7, 'd');

            //Check orders by user in past week and if greater than or equal to two reject
            const prevOrders = await Order.countDocuments({
                date: {
                    $gte: lastWeek,
                    $lte: today
                },
                userId
            });

            if(prevOrders >= 2){
                return res.status(400).json({success: false, code: responseCodes.MAX_ORDERS_FOR_WEEK})
            }
        }

        const bars = {};

        //Select bars that exist and have a valid amount made
        await vouchers.reduce(async (prevBar, {barId}) => {
            await prevBar;
            bars[barId] = await Bar.findOne({_id: barId, amountMade: {$lte: 500000}});
        }, Promise.resolve());

        //Filter the bars that weren't selected
        vouchers = vouchers.filter(({barId}) => !!bars[barId]);


        //If no vouchers in the filtered array then the person paid for a totally invalid amount of vouchers
        if(vouchers.length === 0){
            return res.status(400).json({
                success: false,
                code: responseCodes.BAR_REACHED_LIMIT
            })
        }

        const barsToSave = [];

        let vouchersDb = await Promise.all(
            vouchers.map(async voucher => {
                //Increase bar's amount made
                bars[voucher.barId].amountMade += voucher.quantity * voucher.price;
                barsToSave.push(voucher.barId)
                //Get an array of the vouchers separated
                const vouchers = [...Array(voucher.quantity)].map(_ => getVoucherData(voucher, {
                    isGuest,
                    guestData: userDetails,
                    userId
                }));
                //Return created vouchers
                return Voucher.create(vouchers)
            })
        );

        await Promise.all(
            [...new Set(barsToSave)].map(id => {
                return bars[id].save()
            })
        )

        //Flatten array of created vouchers
        vouchersDb = vouchersDb.flat(1);

        const orderObj = {
            vouchers: vouchersDb,
            total: ordersTotal,
            reference
        }

        if(!isGuest){
            orderObj.userId = userId
        }

        //Create order
        const order = await Order.create(orderObj);

        //Create transport
        const smtpTransport = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: 465,
            secure: true,
            auth: {
                user: process.env.SMTP_CONSUMER_USER,
                pass: process.env.SMTP_CONSUMER_PASSWORD
            },
            tls: {
                // do not fail on invalid certs
                rejectUnauthorized: false
            },
        });

        //Get attachments
        const attachments = []

        await order.vouchers.reduce(async (promise, {quantity, price, barId: bar, _id}) => {
            await promise
            //Get voucher html
            const voucherHTML = await getVoucherHTML({
                price: `${price} x ${quantity}`,
                address: bar.address,
                name: bar.barName,
                id: _id
            });

            //Convert voucher html to pdf
            const pdf = await htmlToPdf(voucherHTML);

            attachments.push({
                content: pdf,
                contentType: 'application/pdf',
                contentDisposition: 'attachment',
                fileName: `${bar.barName} * ${quantity}.pdf`
            });
        }, Promise.resolve())

        const mailOptions = {
            to: isGuest ? guestData.email : user.email,
            from: process.env.SMTP_CONSUMER_USER,
            subject: "Here's Your Voucher!",
            attachments
        };


        const email = new Email({
            juice: true,
            juiceResources: {
                preserveImportant: true,
                webResources: {
                    relativeTo: path.resolve('emails')
                }
            },
            transport: smtpTransport,
            //Uncomment this line to make it send mails in development
            // send: true
        });

        //Get transformed array of vouchers that'll be used in the order mail
        const vouchersMail = vouchers.map(({quantity, price, barId}) => (
            {
                title: `${bars[barId].barName} x ${quantity}`,
                price,
                image: bars[barId].image
            }
        ));

        await email.send({
            message: mailOptions,
            template: 'order',
            locals: {
                orderId: `#${order._id}`.toUpperCase(),
                vouchers: vouchersMail,
                name: isGuest ? guestData.firstname : user.firstname
            }
        });

        if(!isGuest){
            user.vouchersUsed += vouchersDb.length;
            await user.save();
        }

        res.json({
            success: true,
            order
        })
    } catch (err) {
        console.log(err);
        res.status(500).send({success: false, code: responseCodes.SERVER_ERROR});
    }

});


router.route('/use-voucher/:_id')
    .get(auth(true), async (req, res) => {

        try {

            const verifyVoucher = await Voucher.findById(req.params._id);
            if (!verifyVoucher) {
                return res.status(404).json({
                    message: 'Voucher does not exist',
                    success: false,
                    code: responseCodes.VOUCHER_NOT_FOUND
                })
            } else if (verifyVoucher.used) {
                return res.status(404).json({
                    message: 'Voucher has been used',
                    success: false,
                    code: responseCodes.VOUCHER_USED
                })
            } else {
                verifyVoucher.used = true;
                await verifyVoucher.save();
                return res.json({
                    success: true,
                    message: 'Voucher found!'
                });
            }
        } catch (err) {
            res.status(500).send({success: false, code: responseCodes.SERVER_ERROR});
        }
    });

router.get('/byUser/:userId', auth(), async (req, res) => {
    if(String(req.user.id) !== req.params.userId){
        return res.status(401).json({
            message: 'User not authorized',
            code: responseCodes.NOT_AUTHORISED
        })
    }

    try {
        const vouchers = await Voucher.find({userId: req.params.userId});
        res.json({
            success: true,
            vouchers
        })
    } catch (e) {
        res.status(500).send({success: false, code: responseCodes.SERVER_ERROR});
    }
});

router.get('/byOwner/:barId', auth(true), async (req, res) => {
    let {page = 1, pageSize = 10} = req.query;

    if(String(req.user.bar) !== req.params.barId){
        return res.status(401).json({
            message: 'User not authorized',
            code: responseCodes.NOT_AUTHORISED
        })
    }

    pageSize = Number(pageSize);
    page = Number(page);

    try {
        let vouchers = await Voucher.find(
            {
                barId: req.params.barId
            },
            null,
            {
                skip: (page - 1) * pageSize,
                limit: pageSize
            }
        ).populate('userId').lean();

        const count = await Voucher.countDocuments({
            barId: req.params.barId
        });

        vouchers = vouchers.map(({userId, isGuest, guestData, ...fields}) => {
            if (isGuest) {
                return {
                    ...fields,
                    user: guestData
                }
            } else {
                return {
                    ...fields,
                    user: userId
                }
            }
        });
        res.json({
            success: true,
            vouchers,
            totalPages: Math.ceil(count / pageSize),
            currentPage: page
        })
    } catch (e) {
        res.status(500).send({success: false, code: responseCodes.SERVER_ERROR});
    }
});

module.exports = router;