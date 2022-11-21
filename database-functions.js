import {initializeApp} from 'https://www.gstatic.com/firebasejs/9.2.0/firebase-app.js'
import {getAuth, signInWithRedirect, GoogleAuthProvider, onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/9.2.0/firebase-auth.js'
import {getDatabase, child, push, ref, update, get, onValue, onChildAdded, onChildChanged, onChildRemoved, set, off} from 'https://www.gstatic.com/firebasejs/9.2.0/firebase-database.js'
const firebaseConfig = {
  apiKey: "AIzaSyChiEAP1Rp1BDNFn7BQ8d0oGR65N3rXQkE",
  authDomain: "eyesee-d0a42.firebaseapp.com",
  databaseURL: "https://eyesee-d0a42-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "eyesee-d0a42",
  storageBucket: "eyesee-d0a42.appspot.com",
  messagingSenderId: "56834287411",
  appId: "1:56834287411:web:999340ed2fd5165fa68046"
};
let App = null;
let Database = null;
let Auth = null;
let User = null;
let StateListeners = [];

function authChange(user){
  User = user;

  let newListeners = [];
  for (let obj of StateListeners) {
    if (obj instanceof Function) {
      if (obj(user) != "remove") newListeners.push(obj);
    } else if (typeof obj === 'object' && obj !== null) {
      if (obj.onauthchange instanceof Function) {
        if (obj.onauthchange(user) != "remove") newListeners.push(obj);
      }
    }
  }

  StateListeners = newListeners;
}
async function listenTo(fref, callback) {
  return new Promise((resolve, reject) => {
    if (callback instanceof Function) {
      try {
        let stop = onValue(fref, callback, (sc) => {
          callback(sc.val());
          resolve(stop);
        }, () => {
          resolve(false);
        });
      } catch(e) {
        resolve(false);
      }
    } else {
      resolve(false);
    }
  });
}
function sessionRef(sessionID, childKey) {
  let sref = null;
  if (Database != null) {
    ref(Database, "sessions/" + sessionID);
    if (typeof childKey === "string") sref = child(sref, childKey);
  }
  return sref;
}
function patientRef(sessionID) {
  let pref = null;
  let uid = getUID();
  if (uid != null) {
    pref = child(sessionRef(sessionID, "patients"), uid);
  }
  return pref;
}
async function isOwner(sessionId){
  let isowner = false;
  try {
    let owner = (await get(sessionRef(sessionID, "owner"))).val();
    if (owner == getUID()) {
      isowner = true;
    }
  } catch(e) {
    isowner = false;
  }
  return isowner;
}

async function initializeFirebase(config = firebaseConfig) {
  App = initializeApp(config);
  Database = getDatabase(APP);
  Auth = getAuth();

  onAuthStateChanged(AUTH, (userData) => {
    if (userData == null) {
      authChange(userData);
    } else {
      if (!(User != null && User.uid === userDat.uid)) {
        authChange(userData);
      }
    }
  });
}


function getUID(){
  let uid = null
  if (User != null) {
    uid = User.uid;
  }
  return uid;
}
function getUser(){
  return User;
}


function addAuthChangeListener(obj) {
  StateListeners.push(obj);
}

function login(){
  const provider = new GoogleAuthProvider();
  signInWithRedirect(Auth, provider);
}

function logout(){
  Auth.signOut();
}


async function makeSession() {
  let sessionID = null;
  try {
    sessionID = getUID();
    let session = {
      "owner": sessionID,
    }
    await set(sessionRef(sessionID), session);
  } catch(e) {
    sessionID = null;
  }
  return sessionID;
}

// join a session
async function joinSession(sessionID) {
  let sessionObj = {};
  let stop = null;
  if (await isOwner()) {
    // update session info
    sessionObj.update = async (session) => {
      try {
        await set(sessionRef(sessionID, "info", session.info))
        return true;
      } catch (e) {
        return false;
      }
    }

    // watch for changes in patients directory
    stop = await listenTo(sessionRef(sessionID, "patients"), (patients) => {
      if (sessionObj.onpatientinfo instanceof Function) {
        sessionObj.onpatientinfo(patients);
      }
    });
  } else {
    let update = async (session) => {
      try {
        await set(patientRef(), session.patients.uid);
        return true;
      } catch(e) {
        return false;
      }
    }
    // watch for changes in info call session update on change
    let stop = await listenTo(sessionRef(sessionID, "info"), (info) => {
      if (sessionObj.oninfo instanceof Function) {
        sessionObj.oninfo(info);
      }
    })
  }
  if (stop == false) {
    sessionObj = null;
  }
  return sessionObj;
}

initializeApp();

export {addAuthChangeListener, login, logout, makeSession, joinSession}
