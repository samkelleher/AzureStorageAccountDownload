import Azure from '@azure/storage-blob';
import fs from 'fs';
import debug from 'debug';
import getConfig from './getConfig';

const fsPromises = fs.promises;
const debugController = debug('Controller');
const debugFile = debug('RemoteFile');
const debugDirectory = debug('Directory');

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

async function processContainer(container, storeDirectory, storageAccountName, serviceURL) {
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
    const filesInLocalContainer = files.length;
    debugController(`${storeDirectoryStats.isSymbolicLink() ? 'Symbolic ' : ''}Container ${container.name} exists , it contains ${filesInLocalContainer} files, and will now sync...`);

    const containerURL = Azure.ContainerURL.fromServiceURL(serviceURL, container.name);

    let marker;
    let localCopiesAlreadyExisted = 0;
    let filesCopied = 0;
    let filesFailed = 0;
    do {
        const listBlobsResponse = await containerURL.listBlobFlatSegment(
            Azure.Aborter.none,
            marker
        );

        marker = listBlobsResponse.nextMarker;
        for (const blob of listBlobsResponse.segment.blobItems) {
            let localFilePath = `${storeDirectoryWithContainer}${blob.name}`;

            try {
                await fsPromises.access(localFilePath);
                localCopiesAlreadyExisted += 1;
                continue;
            } catch (err) {
                if (err.code !== 'ENOENT') {
                    // Swallow the 'does not exist' error, since we will create it.
                    // otherwise we skip it.
                    debugFile(`${blob.name} > ${localFilePath} - ERROR: `, err);
                    filesFailed += 1;
                    continue;
                }
            }

            debugFile(`${blob.name} > ${localFilePath} - TODO`);
            try {
                const blobURL = Azure.BlobURL.fromContainerURL(containerURL, blob.name);
                const blockBlobURL = Azure.BlockBlobURL.fromBlobURL(blobURL);
                const downloadBlockBlobResponse = await blockBlobURL.download(Azure.Aborter.none, 0);
                const fileStream = fs.createWriteStream(localFilePath);
                await new Promise((writeFinished, writeFailed) => {
                    const stream = downloadBlockBlobResponse.readableStreamBody.pipe(fileStream);
                    stream.on('finish', () =>{
                        writeFinished();
                    });
                });
            } catch (err) {
                debugFile(`${blob.name} > ${localFilePath} - FAILED`, err);
                filesFailed += 1;
                continue;
            }

            filesCopied += 1;
            debugFile(`${blob.name} > ${localFilePath} - COMPLETE - SUCCESS`);
        }
    } while (marker);

    debugDirectory(`${localCopiesAlreadyExisted} local files already existed for ${container.name}, ${filesCopied} files copied, ${filesFailed} files failed.`);
}

async function beginSync({ storageAccountName, storageAccountKey, storeDirectory }) {
    const sharedKeyCredential = new Azure.SharedKeyCredential(storageAccountName, storageAccountKey);
    const pipeline = Azure.StorageURL.newPipeline(sharedKeyCredential);

    const serviceURL = new Azure.ServiceURL(
        `https://${storageAccountName}.blob.core.windows.net`,
        pipeline
    );

    const containers = await getContainers(serviceURL);

    for (const container of containers) {
        if (container.name === '$root') {
            debugController('Skipping root container.');
            continue;
        }

        try {
            debugDirectory(`Starting ${container.name}.`);
            await processContainer(container, storeDirectory, storageAccountName, serviceURL);
            debugDirectory(`Finished ${container.name}.`);
        } catch (ex) {
            debugDirectory(`Failed ${container.name}`, ex);
        }
    }

    debugController('All finished.');
}

beginSync(getConfig())
    .then(() => { console.log('Finished') })
    .catch(error => { throw error });
