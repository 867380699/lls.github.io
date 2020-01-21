import utils from './utils.js';

const iconApi = 'https://s2.googleusercontent.com/s2/favicons';
const dbName = 'db_quarrel';
let dbQuarrel;
const iconMap = {};

function init () {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(dbName);
    request.onerror = function (event) {
      reject(event);
    };
    request.onsuccess = function (event) {
      resolve(request.result);
    };
    request.onupgradeneeded = function (event) {
      console.log('upgrade');
      const db = event.target.result;
      var objectStore;
      if (!db.objectStoreNames.contains('bookmark')) {
        objectStore = db.createObjectStore('bookmark', { keyPath: 'url'  });
      }
      if (!db.objectStoreNames.contains('favicon')) {
        objectStore = db.createObjectStore('favicon', { keyPath: 'host' });
      }
    }  
  })
}

function getDB() {
  return new Promise((resolve, reject) => {
    if (dbQuarrel) {
      resolve(dbQuarrel);
    } else {
      init().then((db)=>{
        dbQuarrel = db;
        resolve(db);
      });
    }
  })
}

function saveBookmark(title, url) {
  return new Promise((resolve, reject)=>{
    const data = {title, url, timestamp: utils.currentTimestamp()};

    getDB().then(db=>{
      const getRequest = db.transaction(['bookmark']).objectStore('bookmark').get(url);
      
      getRequest.onsuccess = function(event) {
        if (getRequest.result) {
          const putReq = db.transaction(['bookmark'], 'readwrite').objectStore('bookmark').put(data);
          putReq.onsuccess = function(event) {
            console.log('db-update', event, data);
            resolve({type:'update', data});
          }
          putReq.onerror = function (event) {
            console.log('db-update-error: ', event);
            reject(event);
          }
        } else {
          const addReq = db.transaction(['bookmark'], 'readwrite').objectStore('bookmark').add(data);
          addReq.onsuccess = function(event) {
            console.log('db-save', event, data);
            saveIcon(url);
            resolve({type:'create', data});
          }
          addReq.onerror = function (event) {
            console.log('db-save-error: ', event);
            reject(event);
          }
        }
      };
      getRequest.onerror = function(event) {
        reject(event);
      }
    })
  })
};

function loadAllBookmark() {
  return new Promise((resolve, reject)=>{
    getDB().then((db)=>{
      let bookmarks = [];
      const objectStore = db.transaction('bookmark').objectStore('bookmark');
      objectStore.openCursor().onsuccess = function (event) {
        var cursor = event.target.result;
      
        if (cursor) {
          bookmarks.unshift(cursor.value);
          cursor.continue();
        } else {
          // timestamp DESC
          resolve(bookmarks.sort((b1,b2)=>{return b2.timestamp-b1.timestamp}));
        }
      };
    })
  })
}

function removeBookmarkByUrl(url) {
  getDB().then((db)=>{
    const request = db.transaction(['bookmark'], 'readwrite').objectStore('bookmark').delete(url);
    request.onsuccess = function(event) {
      console.log('db-delete', event);
    }
    request.onerror = function (event) {
    }
  });
}

function saveIcon(url) {
  const hostname = new URL(url).hostname;
  fetch(`${iconApi}?domain=${hostname}`)
    .then((resp)=>{
      return resp.blob()
    }).then((img)=>{
      getDB().then(db=>{
        db.transaction(['favicon'], 'readwrite').objectStore('favicon').put({
          host:hostname,
          blob: img
        });
      })
      console.log(URL.createObjectURL(img))
    });
}

function getIcon(url) {
  return new Promise((resolve, reject)=>{
    const hostname = new URL(url).hostname;
    if (iconMap[hostname]) {
      resolve(iconMap[hostname]);
    };
    getDB().then(db=>{
      request = db.transaction(['favicon']).objectStore('favicon').get(hostname);
      request.onsuccess((event)=>{
        if (request.result) {
          iconMap[hostname] = URL.createObjectURL(response.result.blob);
          resolve(iconMap[hostname]);
        } else {
          reject(event.blob);
        }
      });
      request.onerror((event)=>{
        reject(event);
      })
    })
  })
}

function loadAllIcons(bookmarks) {
  return new Promise((resolve, reject)=>{
    const hosts = new Set(bookmarks.map(b => new URL(b.url).hostname));
    getDB().then((db)=>{
      const objectStore = db.transaction('favicon').objectStore('favicon');
      objectStore.openCursor().onsuccess = function (event) {
        const cursor = event.target.result;
        if (cursor) {
          const cHost = cursor.value.host;
          if (!iconMap[cHost] && hosts.has(cHost)) {
            iconMap[cHost] = URL.createObjectURL(cursor.value.blob);
          }
          cursor.continue();
        } else {
          resolve(iconMap);
        }
      }
    });
  });
}


export default {
  loadAllBookmark,
  saveBookmark,
  removeBookmarkByUrl,
  loadAllIcons
}