'use strict';

const _ = require('underscore');
const printf = require('util').format;
const azure = require('azure-storage');
const URL = require('url');

class MultiStorageAzureBlob {

	constructor(options) {

		if (!options) {
			options = {};
		}

		let accountName = options.accountName;
		let key = options.key;
		let containerName = options.container;

		if (!_.isString(accountName) || accountName.length === 0) {
			throw new Error(printf('Need the account name but got "%s"', accountName));
		}

		if (!_.isString(key) || key.length === 0) {
			throw new Error(printf('Need the key but got "%s"', key));
		}

		this._service = azure.createBlobService(accountName, key);
		this._containerName = containerName;
		this._useFirstFolderAsContainer = !!options.firstFolderIsContainer;

		this.manager = null;
	}

	get name() {
		return 'azure-blob';
	}

	get schemes() {
		return ['azure-blob'];
	}

	/**
	 * The blob service connection.
	 * @type {BlobService}
	 */
	get service() {
		return this._service;
	}

	/**
	 * The name of the container used for this provider.
	 * @type {String}
	 */
	get containerName() {
		return this._containerName;
	}

	/**
	 * Returns the url for the given filename. This URL is only for multi-storage address purpose and does not address
	 * the resource via a HTTP request.
	 * @param filename {String}
	 * @private
	 */
	_urlForFilename(filename, containerName) {
		filename = filename
			.split('/')
			.filter(candidate => candidate.length > 0)
			.join('/');

		if (!containerName) {
			containerName = this.containerName;
		}
		return printf('azure-blob://%s/%s', containerName, filename);
	}

	/**
	 * Returns a promise that resolves with the service when the container has been created.
	 * @return {Promise}
	 * @param containerName {String}
	 * @private
	 */
	_createContainerIfNotExists(containerName) {
		if (!_.isString(containerName) || containerName.length < 0) {
			throw new Error(printf('Need the name of the container to create but got "%s"', containerName));
		}

		let service = this.service;
		let manager = this.manager;
		return new Promise((resolve, reject) => {
			service.createContainerIfNotExists(containerName, (err, result, response) => {
				
				if (manager) {
					manager._debug(printf('Creating container %s (of it does not yet exist)', containerName));
				}
				
				if (err) {
					if (manager) {
						manager._error(printf('Failed to create container %s due to error: %s', err.message));
					}
					reject(err);
				} else {
					resolve(service);
				}
			});
		});
	}


	postStream(options) {
		let manager = this.manager;

		let name = options.name;
		let path = options.path;
		if (_.isString(path) && path.length > 0) {
			name = (path + '/' + name).split('/').filter(candidate => candidate.length > 0).join('/');
		}

		let containerName = null;
		let scheme = this.schemes[0];

		if (this._useFirstFolderAsContainer) {
			let pathComponents = name.split('/').filter(candidate => candidate.length > 0);
			if (pathComponents.length < 2) {
				return Promise.reject(new Error(printf('The file name "%s" has no container name altough the first folder is expected to be the container name.', name)));
			}
			containerName = pathComponents[0];
			name = pathComponents.slice(1).join('/');
		} else {
			containerName = options.container || this.containerName;
		}

		if (!_.isString(containerName) || containerName.length === 0) {
			return Promise.reject(new Error('Could not determine the container name.'));
		}

		if (manager) {
			manager._debug(printf('Posting stream %s in %s', name, containerName));
		}
		let url = this._urlForFilename(name, containerName);
		return this._createContainerIfNotExists(containerName)
			.then((service) => {
				let stream = service.createWriteStreamToBlockBlob(containerName, name);
				stream.url = url;
				return Promise.resolve(stream);
			});
	}

	_containerNameFromUrl(url) {
		if (!url.includes('://')) {
			return null;
		}

		let parsedURL = URL.parse(url);
		if (parsedURL) {
			let container = parsedURL.host;
			return container;
		}

		return null;
	}

	_filenameFromUrl(url) {
		if (!url.includes('://')) {
			return null;
		}

		let parsedURL = URL.parse(url);
		if (parsedURL) {
			let path = parsedURL.pathname
				.split('/')
				.filter(candidate => candidate.length > 0)
				.join('/');
			return path;
		}

		return null;
	}

	/**
	 * Returns a promise that resolves with the properties of the blob represented by the given url.
	 * @param url {string}
	 * @return {Promise}
	 * @private
	 */
	_getProperties(url) {
		let manager = this.manager;

		let containerName = this._containerNameFromUrl(url);
		let filename = this._filenameFromUrl(url);

		if (!_.isString(containerName) || !_.isString(filename)) {
			return Promise.reject(new Error(printf('Invalid URL %s', url)));
		}

		if (manager) {
			manager._debug(printf('Requesting properties for %s in %s', filename, containerName));
		}
		let service = this.service;
		return new Promise((resolve, reject) => {
			service.getBlobProperties(containerName, filename, (err, properties, status) => {
				if (err) {
					if (manager) {
						manager._error(printf('Failed to get properties for %s in %s due to error: ', filename, containerName, err.message));
					}
					return reject(err);
				}
				if (!status.isSuccessful) {
					return reject(new Error('The blob with the URL %s does not exist.', url));
				}
				resolve(properties);
			});
		});
	}

	getStream(url) {
		let manager = this.manager;
		let containerName = this._containerNameFromUrl(url);
		let filename = this._filenameFromUrl(url);

		if (!_.isString(containerName) || !_.isString(filename)) {
			return Promise.reject(new Error(printf('Invalid URL %s', url)));
		}

		if (manager) {
			manager._debug(printf('Getting stream for %s in %s', filename, containerName));
		}
		let service = this.service;
		return this._getProperties(url)
			.then((properties) => {
				let stream = service.createReadStream(containerName, filename);
				stream.azureBlobProperties = properties;
				return stream;
			});

	}

	delete(url) {
		let manager = this.manager;
		let containerName = this._containerNameFromUrl(url);
		let filename = this._filenameFromUrl(url);

		if (!_.isString(containerName) || !_.isString(filename)) {
			return Promise.reject(new Error(printf('Invalid URL %s', url)));
		}

		if (manager) {
			manager._debug(printf('Deleting %s in %s', filename, containerName));
		}
		let service = this.service;
		return new Promise((resolve, reject) => {
			service.deleteBlob(containerName, filename, (err, _response) => {
				if (err && err.code.toLowerCase() === 'blobnotfound') {
					manager._debug(printf('Blob %s in %s not found, ignoring error since we wanted to delete', filename, containerName));
					err = null;
				}

				if (err) {
					if (manager) {
						manager._error(printf('Failed to delete %s in %s due to error: %s', filename, containerName, err.message));
					}
					return reject(err);
				}
				resolve();
			});
		});
	}

}

MultiStorageAzureBlob.createWithConnectionString = function(connectionString) {

};

module.exports = MultiStorageAzureBlob;
