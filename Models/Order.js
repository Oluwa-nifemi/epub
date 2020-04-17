const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const orderSchema = new Schema({
    date: {
        type: Date,
        default: Date.now()
    },
    userId: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    barId: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: 'Bar'
    },
    vouchers: [
        {
            type: Schema.Types.ObjectId,
            required: true,
            ref: 'Voucher'
        }
    ]
});

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;