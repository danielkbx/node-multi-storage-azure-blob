'use strict';

/*jshint -W030 */

const expect = require('chai').expect;
const _ = require('underscore');
const MultiStorageAzureBlob = require('../');
const URL = require('url');
const fs = require('fs');
const azure = require('azure-storage');

let accountName = null;
let key = null;
let containerName = 'test';
let blobService = null;

describe('Azure Blob Storage', () => {

	before(() => {
		accountName = process.env.ACCOUNT_NAME;
		key = process.env.KEY;
		expect(_.isString(accountName)).to.be.true;
		expect(_.isString(accountName)).to.be.true;
		blobService = azure.createBlobService(accountName, key);
	});

	describe('URLs', () => {

		describe('_urlForFilename', () => {

			it('returns the correct url', () => {
				// given
				let provider = new MultiStorageAzureBlob({accountName: accountName, key: key, container: 'container'});

				// when
				let url = provider._urlForFilename('filename.txt');

				// then
				expect(url).to.equal('azure-blob://container/filename.txt');
			});

			it('returns the correct url with a custom container name', () => {
				// given
				let provider = new MultiStorageAzureBlob({accountName: accountName, key: key, container: 'container'});

				// when
				let url = provider._urlForFilename('filename.txt', 'myContainer');

				// then
				expect(url).to.equal('azure-blob://myContainer/filename.txt');
			});

			it('returns the correct url with folders', () => {
				// given
				let provider = new MultiStorageAzureBlob({accountName: accountName, key: key, container: 'container'});

				// when
				let url = provider._urlForFilename('folder/subfolder/filename.txt');

				// then
				expect(url).to.equal('azure-blob://container/folder/subfolder/filename.txt');
			});

			it('removes leading /', () => {
				// given
				let provider = new MultiStorageAzureBlob({accountName: accountName, key: key, container: 'container'});

				// when
				let url = provider._urlForFilename('/filename.txt');

				// then
				expect(url).to.equal('azure-blob://container/filename.txt');
			});

			it('removes trailing /', () => {
				// given
				let provider = new MultiStorageAzureBlob({accountName: accountName, key: key, container: 'container'});

				// when
				let url = provider._urlForFilename('filename.txt/');

				// then
				expect(url).to.equal('azure-blob://container/filename.txt');
			});

			it('removes double /', () => {
				// given
				let provider = new MultiStorageAzureBlob({accountName: accountName, key: key, container: 'container'});

				// when
				let url = provider._urlForFilename('folder//filename.txt');

				// then
				expect(url).to.equal('azure-blob://container/folder/filename.txt');
			});

		});

		describe('_containerNameFromUrl', () => {

			it('Extracts the container name from a url', () => {
				// given
				let provider = new MultiStorageAzureBlob({accountName: accountName, key: key, container: 'blabb'});

				// when
				let container = provider._containerNameFromUrl('azure-blob://container/filename.txt');

				// then
				expect(container).to.equal('container');

			});

			it('Returns null for an invalid url', () => {
				// given
				let provider = new MultiStorageAzureBlob({accountName: accountName, key: key, container: 'blabb'});

				// when
				let container = provider._containerNameFromUrl('azure-blob');

				// then
				expect(container).not.to.be.ok;

			});

		});

		describe('_filenameFromUrl', () => {

			it('Extracts the filename form  a url', () => {
				// given
				let provider = new MultiStorageAzureBlob({accountName: accountName, key: key, container: 'blabb'});

				// when
				let filename = provider._filenameFromUrl('azure-blob://container/filename.txt');

				// then
				expect(filename).to.equal('filename.txt');
			});

			it('Extracts the filename with a folder form a url', () => {
				// given
				let provider = new MultiStorageAzureBlob({accountName: accountName, key: key, container: 'blabb'});

				// when
				let filename = provider._filenameFromUrl('azure-blob://container/folder/subfolder/filename.txt');

				// then
				expect(filename).to.equal('folder/subfolder/filename.txt');
			});

			it('Returns null for an invalid url', () => {
				// given
				let provider = new MultiStorageAzureBlob({accountName: accountName, key: key, container: 'blabb'});

				// when
				let filename = provider._filenameFromUrl('azure-blob');

				// then
				expect(filename).not.to.be.ok;
			});

			it('Cleans the filename form a url', () => {
				// given
				let provider = new MultiStorageAzureBlob({accountName: accountName, key: key, container: 'blabb'});

				// when
				let filename = provider._filenameFromUrl('azure-blob://container/folder//filename.txt');

				// then
				expect(filename).to.equal('folder/filename.txt');
			});

		});

	});

	describe('postStream', () => {

		it('posts the stream', (done) => {
			// given
			let options = {name: 'folder1/testfile.txt'};
			let provider = new MultiStorageAzureBlob({accountName: accountName, key: key, container: containerName});

			// when
			provider.postStream(options)
				.then((stream) => {
					return new Promise((resolve, reject) => {
						stream.on('error', err => reject(err));
						stream.on('finish', () => resolve(stream));
						stream.end('some data');
					});
				})
				.then((stream) => {
					let expectedUrl = 'azure-blob://' + containerName + '/' + options.name;
					expect(stream.url).to.equal(expectedUrl);

					return new Promise((resolve, reject) => {
						// then
						blobService.getBlobToText(containerName, options.name, (err, result, response) => {
							if (err) {
								return reject(err);
							}
							expect(result).to.equal('some data');
							resolve(stream.url);
						});
					});
				})
				.then((url) => provider.delete(url))
				.then(() => done())
				.catch(err => done(err));
		});

		it('posts the stream using a path', (done) => {
			// given
			let options = {name: 'testfileWithPath.txt', path: 'folder1'};
			let provider = new MultiStorageAzureBlob({accountName: accountName, key: key, container: containerName});

			// when
			provider.postStream(options)
				.then((stream) => {
					return new Promise((resolve, reject) => {
						stream.on('error', err => reject(err));
						stream.on('finish', () => resolve(stream));
						stream.end('some data');
					});
				})
				.then((stream) => {
					let expectedUrl = 'azure-blob://' + containerName + '/' + options.path + '/' + options.name;
					expect(stream.url).to.equal(expectedUrl);

					return new Promise((resolve, reject) => {
						// then
						blobService.getBlobToText(containerName, options.path + '/' + options.name, (err, result, response) => {
							if (err) {
								return reject(err);
							}
							expect(result).to.equal('some data');
							resolve(stream.url);
						});
					});
				})
				.then((url) => provider.delete(url))
				.then(() => done())
				.catch(err => done(err));
		});

		it('posts the stream with a custom container name', (done) => {
			// given
			let options = {name: 'folder1/testfile.txt', container: 'test2'};
			let provider = new MultiStorageAzureBlob({accountName: accountName, key: key, container: containerName});

			// when
			provider.postStream(options)
				.then((stream) => {
					return new Promise((resolve, reject) => {
						stream.on('error', err => reject(err));
						stream.on('finish', () => resolve(stream));
						stream.end('some data');
					});
				})
				.then((stream) => {
					let expectedUrl = 'azure-blob://' + options.container + '/' + options.name;
					expect(stream.url).to.equal(expectedUrl);

					return new Promise((resolve, reject) => {
						// then
						blobService.getBlobToText(options.container, options.name, (err, result, response) => {
							if (err) {
								return reject(err);
							}
							expect(result).to.equal('some data');
							resolve(stream.url);
						});
					});
				})
				.then((url) => provider.delete(url))
				.then(() => done())
				.catch(err => done(err));
		});

		it('posts the stream using the first folder as container', (done) => {
			// given
			let options = {name: 'folderascontainer/folder1/testfile.txt'};
			let provider = new MultiStorageAzureBlob({accountName: accountName, key: key, container: containerName, firstFolderIsContainer: true});

			// when
			provider.postStream(options)
				.then((stream) => {
					return new Promise((resolve, reject) => {
						stream.on('error', err => reject(err));
						stream.on('finish', () => resolve(stream));
						stream.end('some data');
					});
				})
				.then((stream) => {
					let expectedUrl = 'azure-blob://folderascontainer/folder1/testfile.txt';
					expect(stream.url).to.equal(expectedUrl);

					return new Promise((resolve, reject) => {
						// then
						blobService.getBlobToText('folderascontainer', 'folder1/testfile.txt', (err, result, response) => {
							if (err) {
								return reject(err);
							}
							expect(result).to.equal('some data');
							resolve(stream.url);
						});
					});
				})
				.then((url) => provider.delete(url))
				.then(() => done())
				.catch(err => done(err));
		});

	});

	describe('getStream', () => {

		it('reads the stream', (done) => {
			// given
			let filename = 'folder1/testfile2.txt';
			let url = 'azure-blob://' + containerName + '/' + filename;
			let provider = new MultiStorageAzureBlob({accountName: accountName, key: key, container: containerName});

			blobService.createBlockBlobFromText(containerName, filename, 'some nice data', (err, result) => {
				if (err) {
					return done(err);
				}

				// when
				let receivedData = '';
				provider.getStream(url)
					.then((stream) => {
						return new Promise((resolve, reject) => {
							stream.on('data', chunk => receivedData += chunk);
							stream.on('end', () => resolve(receivedData));
							stream.on('error', err => reject(err));
						});
					})
					.then((data) => {
						expect(data).to.equal('some nice data');
						return Promise.resolve();
					})
					.then(() => provider.delete(url)) // cleanup
					.then(() => done())
					.catch(err => done(err));
			});

		});

	});

	describe('deleteStream', () => {

		it('deletes the blob', (done) => {
			// given
			let filename = 'folder1/testfile3.txt';
			let url = 'azure-blob://' + containerName + '/' + filename;
			let provider = new MultiStorageAzureBlob({accountName: accountName, key: key, container: containerName});

			blobService.createBlockBlobFromText(containerName, filename, 'some nice data', (err, result) => {
				if (err) {
					return done(err);
				}

				// when
				provider.delete(url)
					.then(() => done())
					.catch(err => done(err));
			});
		});

	});

});