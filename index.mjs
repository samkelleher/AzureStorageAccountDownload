import Azure from '@azure/storage-blob';
import fs from 'fs';
import debug from 'debug';
import getConfig from './getConfig';

const fsPromises = fs.promises;
const debugController = debug('Controller');
const debugFile = debug('RemoteFile');
const debugDirectory = debug('Directory');
const debugLocalFile = debug('LocalFile');

async function getContainers(serviceURL) {
    let marker;
    let containers = [];
    do {
        const listContainersResponse = await serviceURL.listContainersSegment(
            Azure.Aborter.none,
            marker
        );

        marker = listContainersResponse.nextMarker;
        containers = [
            ...containers,
            ...listContainersResponse.containerItems
        ]

    } while (marker);
    return containers;
}

async function beginSync({ storageAccountName, storageAccountKey, storeDirectory, logDownloadsOnly }) {
    const sharedKeyCredential = new Azure.SharedKeyCredential(storageAccountName, storageAccountKey);
    const pipeline = Azure.StorageURL.newPipeline(sharedKeyCredential);

    const serviceURL = new Azure.ServiceURL(
        `https://${storageAccountName}.blob.core.windows.net`,
        pipeline
    );

    const containers = await getContainers(serviceURL);

    let processBatch = async function (container, continuationToken = null) {
        const storeDirectoryWithContainer = `${storeDirectory}${storageAccountName}/${container.name}/`;

        let storeDirectoryStats;
        try {
            storeDirectoryStats = await fsPromises.lstat(storeDirectoryWithContainer);
        } catch (ex) {
            if (ex.code === 'ENOENT') {
                debugController(`Container ${container.name} does not exist locally, will not sync this container, create the folder if you want to sync it.`);
            } else {
                debugController(`Unable to load local container ${container.name} directory.`, ex);
            }
            return;
        }

        const files = await fsPromises.readdir(storeDirectoryWithContainer);
        debugController(`${storeDirectoryStats.isSymbolicLink() ? 'Symbolic ' : ''}Container ${container.name} found, it contains ${files.length} files, and will now sync...`);

        const containerURL = Azure.ContainerURL.fromServiceURL(serviceURL, container.name);

        let marker;
        let localCopiesAlreadyExisted = 0;
        do {
            const listBlobsResponse = await containerURL.listBlobFlatSegment(
                Azure.Aborter.none,
                marker
            );

            marker = listBlobsResponse.nextMarker;
            for (const blob of listBlobsResponse.segment.blobItems) {
                console.log(`Blob: ${blob.name}`);

                let localFilePath = `${storeDirectory}${blob.name}`;

                try {
                    await fsPromises.access(localFilePath);
                } catch (err) {
                    if (err.code !== 'ENOENT') {
                        debugFile(`${blob.name} > ${localFilePath} - ERROR: `, err);
                    }
                    continue;
                }

                debugFile(`${blob.name} > ${localFilePath} - TODO`);
                const downloadBlockBlobResponse = await blob.download(Azure.Aborter.none, 0);

                continue;

                blobService.getBlobToStream(container.name, blob.name, fs.createWriteStream(localFilePath), {}, function (error, result, response) {
                    if (error) {
                        debugFile(`${blob.name} > ${localFilePath} - FAILED`, err);
                        downloadFinished();
                        return;
                    }
                    debugFile(`${blob.name} > ${localFilePath} - COMPLETE - SUCCESS = ${response.isSuccessful}`);
                    downloadFinished();
                });
            }
        } while (marker);

        if (localCopiesAlreadyExisted > 0) {
            debugDirectory(`${localCopiesAlreadyExisted} local files already existed for ${container.name}.`);
        }
    };

    const processBatchQueueItem = async (container, continuationToken = null) => {
        return processBatch(container, continuationToken)
            .then(function (batchResults) {
                if (!batchResults) {
                    debugDirectory(`Finished ${container.name}, but no results...`);
                    return Promise.resolve();
                }
                if (batchResults.continuationToken) {
                    debugDirectory(`Staring next batch for ${container.name}`);
                    return processBatchQueueItem(container, batchResults.continuationToken);
                } else {
                    debugDirectory(`Finished ${container.name}`);
                    return Promise.resolve();
                }
            })
    };

    for (const container of containers) {
        if (container.name === '$root') {
            debugController('Skipping root container.');
            continue;
        }

        debugDirectory(`Starting ${container.name}`);

        try {
            await processBatchQueueItem(container)
        } catch (ex) {
            debugDirectory(`Failed ${container.name}`, ex);
            continue;
        }
    }

    debugController('All finished.');
}

getConfig()
    .then(config => beginSync(config))
    .catch(error => { throw error });
