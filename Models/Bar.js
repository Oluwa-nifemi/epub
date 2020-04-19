const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const barSchema = new Schema({
    barName: {
        type: String,
        required: true,
        trim: true
    },

    image: {
        type: String,
        required: true
    },

    firstName: {
        type: String,
        required: true,
        trim: true,
    },

    lastName: {
        type: String,
        required: true,
        trim: true,
    },

    bvn: {
        type: Number,
        required: true,
        trim: true,
    },

    accountName: {
        type: String,
        required: true,
        trim: true,
    },
    
    accountNumber:{
        type: Number,
        required: true,
        trim: true,
    },
    bankName: {
        type: String,
        required: true,
        trim: true,
    },

    address: {
        type: String,
        required: true,
        trim: true,
    },

    city: {
        type: String,
        required: true,
        trim: true
    },

    phone1: {
        type: Number,
        required: true,
        trim: true,
    },

    phone2: {
        type: Number,
        trim: true,
    },

    email: {
        type: String,
        required: true,
        trim: true,
    },

    date: {
        type: Date,
        default: Date.now
    },

    confirmed: {
        type: Boolean,
        default: false
    }
});

const Bar = mongoose.model('Bar', barSchema);

module.exports = Bar;