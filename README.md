# node-multi-storage-azure-blob

_node-multi-storage-azure-blob_ is a provider for the NodeJS module [node-multi-storage](https://www.npmjs.com/package/node-multi-storage).
It provides saving and reading blobs using Microsoft Azure Blob Storage Service.

Since version 2.0 of this module, node-multi-storage v2.0 or newer is needed.

# Usage

Install `node-multi-storage-azure-blob` and `node-multi-storage`:

```bash
npm install --save node-multi-storage node-multi-storage-azure-blob
```
    
Create an instance of the local storage provider:

```Javascript
let MultiStorageAzure = require('node-multi-storage-azure-blob');
let azureStorageProvider = new MultiStorageAzure(options);
```
    
and add it to the MultiStorage instance (or create it with the provider):

```Javascript
let MultiStorage = require('node-multi-storage');
let storage = new MultiStorage({providers: [azureStorageProvider]});
```
or
```Javascript
let MultiStorage = require('node-multi-storage');
let storage = new MultiStorage();
storage.addProvider(azureStorageProvider);
```
    
The options passed when creating a new instance of _node-multi-storage-local_ has these fields:

- `accountName`: The name of the Azure Storage account.
- `key`: The access key of the Azure Storage account.
- `container`: The name of the container. If not set or `null` the post call must includie the container information.
- `firstFolderIsContainer`: If set to `true`, the first "directory" of the provided path will be used as container name. 


# postStream Options

When posting a stream, an option object can be passed with the following fields:

- `container`: The name of the container for this post. If not given, then container of the provider instance is used
or the first directoy name of `firstFolderIsContainer` was set when creating the provider.
- `contentType`: The MIME type of the data posted.

# Tests

When running the test, you need to provide an account name and a key:

```bash
ACCOUNT_NAME=... KEY==... npm test
```

Further information on how to save and read files, see the documentation of [node-multi-storage](https://www.npmjs.com/package/node-multi-storage).

