'use strict';

module.exports = (event, context, callback) => {
    
    var params = {};

    if (event.body.approved) {
      const purchaseEvent = {
        productId: event.body.id,
        productPrice: event.body.price,
        userId: event.body.user,
        authorization: event.body.authorization,
      };
      params.Data = purchaseEvent;

      
    } else {
      params.Data = `Failed to purchase product. Reason: ${event.failureReason}`
    }
    return callback(null, params);
  };

