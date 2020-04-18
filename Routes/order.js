const express = require('express');
const router = express.Router();
const auth = require('../middleware/oauth');
const nodemailer = require('nodemailer');
const path = require('path');
const Email = require('email-templates');

const Order = require('../Models/Order');
const Voucher = require('../Models/Voucher');
const User = require('../Models/User');
const Bar = require('../Models/Bar');

router.route('/')


    // @route       POST/User
    // @desc        Make new order
    // access       Private

    // .post(auth, async (req, res) => {
    .post(async (req, res) => {

        const {reference, userId, vouchers} = req.body;

        //Verify reference using https://api.paystack.co/transaction/verify/refId

        try {
            const vouchersMapped = vouchers.map(({price, quantity, barId}) => ({
                price,
                quantity,
                userId,
                barId,
                total: quantity * price
            }));

            const vouchersDb = await Voucher.create(vouchersMapped);


            const order = await Order.create({
                userId,
                vouchers: vouchersDb,
                total: vouchersMapped.reduce((currentTotal, {total}) => currentTotal + total, 0)
            });

            const smtpTransport = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: 465,
                secure: true,
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASSWORD
                }
            });

            const user = await User.findById(userId);

            const vouchersMail = await Promise.all(
                vouchers.map(async ({quantity, price, barId}) => {
                    const bar = await Bar.findById(barId);
                    return {
                        title: `${bar.barName} x ${quantity}`,
                        price,
                        image: bar.image
                    }
                })
            );

            const mailOptions = {
                to: user.email,
                from: process.env.SMTP_USER,
                subject: 'Bought Vouchers!',
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

            await email.send({
                message: mailOptions,
                template: 'order',
                locals: {
                    orderId: `#${order._id}`.toUpperCase(),
                    vouchers: vouchersMail
                }
            });


            res.json({
                success: true,
                order
            })
        } catch (err) {
            res.status(500).json({
                success: false,
                message: 'Error: ' + err
            })
        }

    })

    .get(auth, async (req, res) => {

        try {

            const order = await Order.find({user: req.user.id});
            res.json(order)
        } catch (err) {
            res.status(500).json(err + 'Error')
        }
    });

module.exports = router;