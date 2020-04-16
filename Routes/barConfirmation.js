const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');

const Token = require('../Models/Token');
const Bar = require('../Models/Bar');

router.route('/register')

    .post( 
        [
            check('barId', 'Enter Bar ID').not().isEmpty(),
            check('password', 'Password must be six or more characters').isLength({ min: 6 })
        ], async (req, res) => {

            const errors = validationResult(req);
            if(!errors.isEmpty()){
                return res.status(400).json({errors: errors.array()})
            }

            try{

                const {barId, password} = req.body;

                const owner = await Token.find({ bar: barId });
                if(!owner){
                    res.status(400).json({ message: 'User does not exist', success: false})
                }

                const salt = await bcrypt.genSalt(10);
                owner.password = await bcrypt.hash(password, salt);

                await owner.save();
                res.json({owner, success: true});
            }
            catch(err){
                res.status(500).json({message: err + 'Error', success: false})
            }
        
    });

    router.route('/login')
        .post( 
            [
                check('barId', 'Enter Bar ID').not().isEmpty(),
                check('password', 'Please enter a password with six or more characters').isLength({ min: 6})
            ], async (req, res) => {

                const errors = validationResult(req);
                if(!error.isEmpty()){
                    res.status(400).json({errors: errors.array()});
                }

                const { barId, password } = req.body;
                try{

                    let owner = await Token.findOne({ barId });
                    if(!owner){
                        res.status(400).json({ msg: 'Invalid Credential'});
                    }
                    const isMatch = await bcrypt.compare(password, owner.password);
                    
                    if(!isMatch){
                        res.status(400).json({msg: 'Invalid password'})
                        res.json(owner)
                    }
                }
                catch(err){
                    res.status(500).json(err + 'Error')
                }
            })

    module.exports = router;