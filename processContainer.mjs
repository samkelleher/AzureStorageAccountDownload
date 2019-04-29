import fs from 'fs';
import Azure from '@azure/storage-blob';
import debug from 'debug';

const debugController = debug('Controller');
const debugFile = debug('RemoteFile');
const debugDirectory = debug('Directory');
const fsPromises = fs.promises;

export default async function processContainer(container, storeDirectory, storageAccountName, serviceURL) {
    const storeDirectoryWithContainer = `${storeDirectory}${storageAccountName}/${container.name}/`;

    let storeDirectoryStats;
    try {
        storeDirectoryStats = await fsPromises.lstat(storeDirectoryWithContainer);
    } catch (ex) {
        if (ex.code === 'ENOENT') {
            debugController(`Container ${container.name} does not exist locally (${storeDirectoryWithContainer}), will not sync this container, create the folder if you want to sync it.`);
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
