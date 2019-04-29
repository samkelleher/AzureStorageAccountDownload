import Azure from '@azure/storage-blob';
import getContainers from './getContainers';
import processContainer from './processContainer';
import debug from 'debug';

const debugController = debug('Controller');
const debugDirectory = debug('Directory');

export default async function beginSync({ storageAccountName, storageAccountKey, storeDirectory }) {
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
