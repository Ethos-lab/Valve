'use strict';

const { KV_Store } = require('kv-store');
const AJV = require('ajv');
const fs = require('fs');


// TODO Get these from a better place later
const categoryRequestSchema = require('./schemas/categories-request-schema.json');
const categoryItemsSchema = require('./schemas/category-items-schema.json');
const productsRequestSchema = require('./schemas/products-request-schema.json');
const productItemsSchema = require('./schemas/product-items-schema.json');

// TODO generalize this?  it is used by but not specific to this module
const makeSchemaId = schema => `${schema.self.vendor}/${schema.self.name}/${schema.self.version}`;

const categoryRequestSchemaId = makeSchemaId(categoryRequestSchema);
const categoryItemsSchemaId = makeSchemaId(categoryItemsSchema);
const productsRequestSchemaId = makeSchemaId(productsRequestSchema);
const productItemsSchemaId = makeSchemaId(productItemsSchema);

const ajv = new AJV();
ajv.addSchema(categoryRequestSchema, categoryRequestSchemaId);
ajv.addSchema(categoryItemsSchema, categoryItemsSchemaId);
ajv.addSchema(productsRequestSchema, productsRequestSchemaId);
ajv.addSchema(productItemsSchema, productItemsSchemaId);

const constants = {
  // self
  MODULE: 'product-catalog/catalogApi.js',
  // methods
  METHOD_CATEGORIES: 'categories',
  METHOD_PRODUCTS: 'products',
  // resources
  TABLE_PRODUCT_CATEGORY_NAME: process.env.TABLE_PRODUCT_CATEGORY_NAME,
  TABLE_PRODUCT_CATALOG_NAME: process.env.TABLE_PRODUCT_CATALOG_NAME,
  //
  INVALID_REQUEST: 'Invalid Request',
  INTEGRATION_ERROR: 'Integration Error',
  HASHES: '##########################################################################################',
  SECURITY_RISK: '!!!SECURITY RISK!!!',
  DATA_CORRUPTION: 'DATA CORRUPTION',
  HOST: process.env.HOST,
  USER: process.env.USER,
  PASS: process.env.PASS,
  DBNAME: process.env.DBNAME,
};

const impl = {
  response: (statusCode, body) => ({
    statusCode,
    headers: {
      'Access-Control-Allow-Origin': '*', // Required for CORS support to work
      'Access-Control-Allow-Credentials': true, // Required for cookies, authorization headers with HTTPS
    },
    body,
  }),
  clientError: (schemaId, ajvErrors, event) => impl.response(
    400,
    `${constants.METHOD_CATEGORIES} ${constants.INVALID_REQUEST} could not validate request to '${schemaId}' schema. Errors: '${ajvErrors}' found in event: '${JSON.stringify(event)}'` // eslint-disable-line comma-dangle
  ),
  dynamoError: (err) => {
    console.log(err);
    return impl.response(500, `${constants.METHOD_CATEGORIES} - ${constants.INTEGRATION_ERROR}`)
  },
  securityRisk: (schemaId, ajvErrors, items) => {
    console.log(constants.HASHES);
    console.log(constants.SECURITY_RISK);
    console.log(`${constants.METHOD_CATEGORIES} ${constants.DATA_CORRUPTION} could not validate data to '${schemaId}' schema. Errors: ${ajvErrors}`);
    console.log(`${constants.METHOD_CATEGORIES} ${constants.DATA_CORRUPTION} bad data: ${JSON.stringify(items)}`);
    console.log(constants.HASHES);
    return impl.response(500, `${constants.METHOD_CATEGORIES} - ${constants.INTEGRATION_ERROR}`)
  },
  success: items => impl.response(200, JSON.stringify(items)),
};
const api = {
  // TODO deal with pagination
  categories: (event, callback) => {
    
      
      const kv = new KV_Store(constants.HOST, constants.USER, 
          constants.PASS, constants.DBNAME, constants.TABLE_PRODUCT_CATEGORY_NAME);
    console.log(callback.toString());
      
        
      kv.init()
        .then(() => kv.keys())
        .then(result => kv.close().then(() => result))
        .then(result => callback(  impl.success(result)))
        .catch(err => callback( err));
    
  },
  // TODO this is only filter/query impl, also handle single item request
  // TODO deal with pagination
  products: (event, callback) => {
    
      const kv = new KV_Store(constants.HOST, constants.USER, 
        constants.PASS, constants.DBNAME, constants.TABLE_PRODUCT_CATALOG_NAME);

      console.log(event.body);
      // TODO KALEV - Make sure there's an API that exposes the photos.
      // TODO KALEV - Make sure to correctly invoke the callback in case of error (see above).
      kv.init()
        .then(() => kv.entries())
        .then(results => kv.close().then(() => results))
        .then(results =>
          callback(null, impl.success(results.filter(entry => JSON.parse(entry.val).category === event.body.queryStringParameters.category).map(entry => ({
            id: entry.key,
            category: JSON.parse(entry.val).category,
            brand: JSON.parse(entry.val).brand,
            name: JSON.parse(entry.val).name,
            description: JSON.parse(entry.val).description,
          })))))
        .catch(err => callback(err));
  },
};

/**
 * 2 end points
 * 
 * '/categories'
 * '/products'
 */
const entryPoint = {
  handleInput: (event, context, callback) => {
    
    console.log (event);
    if (event.path == '/products') {
      api.products (event, callback);
    } else if (event.path == '/categories') {
      api.categories (event, callback);
    }
  },
 
}

module.exports = entryPoint.handleInput;


