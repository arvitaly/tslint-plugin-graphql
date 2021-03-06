# tslint-plugin-graphql

[![Greenkeeper badge](https://badges.greenkeeper.io/arvitaly/tslint-plugin-graphql.svg)](https://greenkeeper.io/)

Check your GraphQL query strings against a schema.

[![NPM version][npm-image]][npm-url] [![Build Status][travis-image]][travis-url] [![Dependency Status][daviddm-image]][daviddm-url] [![Coverage percentage][coveralls-image]][coveralls-url]
[![experimental](http://badges.github.io/stability-badges/dist/experimental.svg)](http://github.com/badges/stability-badges)

# Install

    npm install tslint-plugin-graphql --save-dev

# Usage

Example of tslint.json

    {
        "extends": [
            "tslint:latest",
            "tslint-plugin-graphql"
        ],
        "rules": {
            "object-literal-sort-keys": false,
            "graphql": [
                true,
                {
                    // Import default settings for your GraphQL client. Supported values:
                    // 'apollo', 'relay', 'lokka'
                    "env": "apollo",
                    "schemaJsonFilepath": "./graphql.schema.json",
                    "tagName": "Relay.QL"
                    // tagName is gql by default 
                }
            ]
        }
    }

# API



# Test

    npm install
    npm test

[npm-image]: https://badge.fury.io/js/tslint-plugin-graphql.svg
[npm-url]: https://npmjs.org/package/tslint-plugin-graphql
[travis-image]: https://travis-ci.org/arvitaly/tslint-plugin-graphql.svg?branch=master
[travis-url]: https://travis-ci.org/arvitaly/tslint-plugin-graphql
[daviddm-image]: https://david-dm.org/arvitaly/tslint-plugin-graphql.svg?theme=shields.io
[daviddm-url]: https://david-dm.org/arvitaly/tslint-plugin-graphql
[coveralls-image]: https://coveralls.io/repos/arvitaly/tslint-plugin-graphql/badge.svg
[coveralls-url]: https://coveralls.io/r/arvitaly/tslint-plugin-graphql
