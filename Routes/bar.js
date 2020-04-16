const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const nodemailer = require('nodemailer');
const randomize = require('randomatic');

const Bar = require('../Models/Bar');
const Token = require('../Models/Token');


router.route('/')


    // @route       POST/
    // @desc        Register new bars
    // access       Public

    .post(
        [
            check('barName', 'Enter bar name').not().isEmpty(),
            check('city', 'Please select a city').not().isEmpty(),
            check('barId', 'Enter bar ID').not().isEmpty(),
            check('bvn', 'Please enter BVN').not()
        ], async (req, res) => {

            const errors = validationResult(req)
            if(!errors.isEmpty()){
                return res.status(400).json({ errors: errors.array()})
            }

        const { 
                barName, 
                firstName, 
                lastName, 
                bvn, 
                accountName, 
                accountNumber,
                bankName,
                address, 
                city,
                phone1,
                phone2,
                email
                } = req.body;

        try{

            let bar = await Bar.findOne({ barId })

            
            if(bar){
                return res.status(400).json({ message: 'bar already exists'})
            }
            
                bar = new Bar({
                barName,
                address,
                city,
                firstName, 
                lastName, 
                bvn, 
                accountName, 
                accountNumber,
                bankName,
                phone1,
                phone2,
                email
            })

            const newBar = await bar.save();
            res.json(newBar);
        }
        catch(err){
            res.status(500).json(err + 'Error')
        }

        const barId = new Token({ bar: bar_id, barId:randomize('Aa', 5, {chars: 'InternationalBreweries'})});
        // randomize.isCrypto;

        const smtpTransport = nodemailer.createTransport({
            service: "gmail",
            host: "smtp.gmail.com",
            auth: {
                user: "stevemckorr@gmail.com",
                pass: "randy_korr1"
            }
        });

        const mailOptions={
            to : bar.email,
            subject : 'Your Bar ID',
            text : 'BarId' + barId
        }

        smtpTransport.sendMail(mailOptions, function (err) {
            if (err) { return res.status(500).send({ msg: err.message }); }
            res.status(200).send('A verification email has been sent to ' + bar.email + '.');
        });
    })
    

    // @route       GET/
    // @desc        Fetch all bars
    // access       Public

    .get( async (req, res) => {

        try{

            const bar = await Bar.find()
            res.json(bar);
        }
        catch(err){
            res.status(500).json(err + 'Error')
        }
    });



router.route('/:_id')
    // @route       GET/
    // @desc         Fetch a single bar
    // access       Public

    .get( async (req, res) => {

        try{
        const bar = await Bar.findById({_id: req.params._id});
        res.json(bar);
        }
        catch(err){
            res.status(500).json(err + 'Error')
        }
    })


    // @route       PATCH/
    // @desc        Updates a specific bar
    // access       Public

    .patch( async (req, res) => {

        try{

            const bar = await Bar.update(
                {_id: req.params._id},
                {$set: req.body}
            )
            res.json(bar)
        }
        catch(err){
            res.status(500).json(err + 'Error')
        }
    });

    module.exports = router;