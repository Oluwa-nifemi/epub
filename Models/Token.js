const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const tokenSchema = new Schema({
    bar: {
        type: Schema.Types.ObjectId,
        ref: 'Bar'
    },

    password: {
        type: String,
    },

    date: {
        type: Date,
        default: Date.now
    }
});

const Token = mongoose.model('Token', tokenSchema);

module.exports = Token;