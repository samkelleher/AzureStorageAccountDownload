import envalid from "envalid";

export default function getConfig() {
    const { str } = envalid;
    const safeEnvironment = envalid.cleanEnv(process.env, {
        AZURE_ACCOUNT_NAME: str(),
        AZURE_ACCOUNT_KEY: str(),
        AZURE_DIRECTORY: str({ default: '' }),
    });

   return {
       storageAccountName: safeEnvironment.AZURE_ACCOUNT_NAME,
       storageAccountKey: safeEnvironment.AZURE_ACCOUNT_KEY,
       storeDirectory: safeEnvironment.AZURE_DIRECTORY
   };
}
