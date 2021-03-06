# Azure Blob Download Utility
> Node utility that will download all files in a Azure hosted blob storage account.

This is a litte dev utiility that will connect to an Azure container, and download a mirror of it to your local machine. Handy during development of an image store for example so you can work offline.

## Getting Started
After cloning this repository run `yarn` to grab its dependencies, then after setting config, `yarn start`.

## Set Config information
To keep the container credentials out of source code, they are read from the environment, or you can source them
by setting them in the `.env` file. If you don't the application will not run.

Copy the `.env.example` file to `.env` and fill in your values to get started, or set them in the environment.

```
AZURE_ACCOUNT_NAME=< YOUR-ACCOUNT NAME HERE >
AZURE_ACCOUNT_KEY=< YOUR KEY HERE >
AZURE_DIRECTORY:< PATH TO LOCAL STORAGE DIRECTORY (for example '../AzureContainers/') >
```

In your store directory, create folders here manually that match the names of folders you want to download. For example,
say your storage account called `Colors` has a container with names `Red`, `Green`, and `Blue`.

You would create in your store directory, a folder for `Colors`, inside of that, a folder called `Red`. When you run the tool
the contents of the `Red` folder will be downloaded locally, while the `Green` and `Blue` folders will be ignored.

If you then decided you also want the `Green` folder, you simply create it.

Add your account information to this file, once set, you can begin the sync program.

```
$ yarn start
```

Each time you run this utility, a full sync will take place. So if you have a lot of files can take some time.

## Features
  - Uses native ECMAScript Modules in Node (ESM)
  - Uses native async/await
  - No Babel or transpile step, raw ECMAScript.
  - Uses latest generation Azure Storage SDKs

## User Story
I have a CMS website that stores user uploaded images to a storage
account on Azure. When I am working offline (such as on a long flight) I
still want to be able to develop on this website and have the uploaded images
appear. I am prepared to sacrificie a few gigabytes of space to copy all
the files in the storage account locally.

I already run the app locally, and am able to run the database
locally, now I want my uploaded files too.

## Disclaimer
The utility does its job, but can be improved and has a _very_ minimal feature
set. I am providing the code AS IS simply incase it is of use to anyone. It
has only been tested on OSX.

## License
This is the work of Sam Kelleher and is provided AS IS.
