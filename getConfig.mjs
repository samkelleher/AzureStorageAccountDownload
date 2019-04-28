import fs from 'fs';
const fsPromises = fs.promises;

export default async function getConfig() {
    const configFileName = 'config.json';

    let file;
    try {
        file = await fsPromises.readFile(configFileName);
    } catch (fileReadError) {
        if (fileReadError.code === 'ENOENT') {
            throw new Error(`The config file '${configFileName}' does not exist.`);
            return;
        }
        throw new Error(`The config file '${configFileName}' could not be read.`, fileReadError);
        console.log(fileReadError);
    }

    let config;
    try {
        config = JSON.parse(file)
    } catch (fileParseError) {
        throw new Error(`The config file '${configFileName}' could not be parsed.`, fileParseError);
    }

    if (!config || !config.storageAccountName || !config.storageAccountKey) {
        throw new Error(`The config file '${configFileName}' has missing data.`);
    }

    return config;
}
