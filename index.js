'use strict';
var azure = require('azure-storage');
var debug = require('debug')('App:Index');
var fs = require('fs');
var path = require('path');
var _ = require('lodash');

var azureConnectionString = 'DefaultEndpointsProtocol=https;AccountName=***REMOVED***;AccountKey=***REMOVED***;BlobEndpoint=https://***REMOVED***.blob.core.windows.net/;TableEndpoint=https://***REMOVED***.table.core.windows.net/;QueueEndpoint=https://***REMOVED***.queue.core.windows.net/;FileEndpoint=https://***REMOVED***.file.core.windows.net/';
var blobSvc = azure.createBlobService(azureConnectionString);

blobSvc.listContainersSegmented(null, {}, function (error, result) {

    if (error) {
        debug('Get Containers Error: ', error);
        return;
    }

    var storeDirectory = '../AzureContainers/***REMOVED***om/tbi/';

    debug('Path is absolute: ', path.isAbsolute(storeDirectory));

    fs.readdir(storeDirectory, function (err, files) {
        if (err) {
            debug('Unable to load store directory', err);
            return;
        }
        debug(`Store found, it contains ${files.length} files.`);
    });

    var processBatch = function (containerName, continuationToken) {
        return new Promise(function (resolve, reject) {

            blobSvc.listBlobsSegmented(containerName, continuationToken, {maxResults: 5000}, function (error, result) {

                if (error) {
                    debug(`Get Blobs Error (${containerName}):`, error);
                    return;
                }


                // debug(`Blobs in ${containerResult.name}`, result.entries);

                _.forEach(result.entries, function (blobResult) {
                    //debug(`Examining ${blobResult.name} (${blobResult.properties['content-type']} ${blobResult.properties['content-length']} bytes)`);

                    var localFilePath = `${storeDirectory}${blobResult.name}`;

                    fs.access(localFilePath, fs.F_OK, function (err, stats) {
                        if (err) {
                            if (err.code === 'ENOENT') {
                                debug(`${blobResult.name} > ${localFilePath} - TODO`);

                                blobSvc.getBlobToStream(containerName, blobResult.name, fs.createWriteStream(localFilePath), {}, function (error, result, response) {
                                    if (error) {
                                        debug(`${blobResult.name} > ${localFilePath} - FAILED`, err);
                                        return;
                                    }
                                    debug(`${blobResult.name} > ${localFilePath} - COMPLETE - SUCCESS = ${response.isSuccessful}`);
                                });

                            } else {
                                debug(`${blobResult.name} > ${localFilePath} - ERROR: `, err);

                            }
                            return;
                        }

                        debug(`${blobResult.name} > ${localFilePath} - EXISTS `);
                    });

                });

                resolve(result.continuationToken);
                if (result.continuationToken) {
                    debug(`There are additional results still to load.`)
                }
            });

        });


    };

    _.forEach(result.entries, function (containerResult) {
        if (containerResult.name === 'tbi') {
            var continuationToken = null;
            var hasRun = false;


            processBatch(containerResult.name, continuationToken)
                .then(function (nextContinuationToken) {
                    hasRun = true;
                    continuationToken = nextContinuationToken;


                    if (continuationToken) {
                        debug('Preparing second batch.');
                        processBatch(containerResult.name, continuationToken)
                            .then(function (nextContinuationToken) {
                                hasRun = true;
                                continuationToken = nextContinuationToken;
                                debug('Preparing another batch.');

                                if (continuationToken) {

                                }
                            });
                    }
                });

            debug('All batch requests complete.');


        }
    })
});