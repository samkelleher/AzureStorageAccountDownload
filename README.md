# Azure Blob Download Utility
> Node utility that will download all files in a Azure hosted blob storage account.

This is a litte dev utiility that will connect to an Azure container, and download a mirror of it to your local machine. Handy during development of an image store for example so you can work offline.

## Getting Started
After cloning this repository run `npm install --production` to grab its dependencies.

## Set Config information
To keep the container credentials out of source code, they are kept in a seperate `config.json` file:

```
{
  "storageAccountName": "<YOUR-ACCOUNT-NAME-HERE>",
  "storageAccountKey": "<YOUR-KEY-HERE>"
}
```

Add your account information to this file, once set, you can begin the sync program.

```
$ npm start
```

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