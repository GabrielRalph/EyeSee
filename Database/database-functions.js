import {initializeApp} from 'https://www.gstatic.com/firebasejs/9.2.0/firebase-app.js'
import {getAuth, signInWithRedirect, GoogleAuthProvider, onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/9.2.0/firebase-auth.js'
import {getDatabase, child, push, ref, update, get, onValue, onChildAdded, onChildChanged, onChildRemoved, set, off} from 'https://www.gstatic.com/firebasejs/9.2.0/firebase-database.js'
import {uploadFileToCloud} from "./fileupload.js"


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

// Simple getters
export function getUser(){
  return User;
}

export function getUID(){
  let uid = null
  if (User != null) {
    uid = User.uid;
  }
  return uid;
}

export function getApp(){return App;}



export function initializeFirebase(config = firebaseConfig) {
  App = initializeApp(config);
  Database = getDatabase(App);
  Auth = getAuth();
  onAuthStateChanged(Auth, async (userData) => {
    console.log("auth state change: user data", userData);
    if (userData == null) {
      authChange(userData);
    } else {

      if (!(User != null && User.uid === userData.uid)) {

        authChange(userData);
      }
    }
  });
}

async function authChange(user){
  User = user;
  if (user != null) {
    let info = await getUserData("info");
    user.info = info;
  }

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

export function addAuthChangeListener(obj) {
  StateListeners.push(obj);
}



export function sessionRef(sessionID, path) {
  let sref = null;
  if (Database != null) {
    sref = ref(Database, "sessions/" + sessionID);
    if (typeof path === "string") sref = child(sref, path);
  }
  return sref;
}
export function usersRef(path) {
  let uref = null;
  let uid = getUID();
  if (uid != null) {
    uref = ref(Database, 'users/' + uid);
    if (typeof path === "string") uref = child(uref, path);
  }
  return uref;
}
export function patientRef(sessionID, path) {
  let pref = null;
  let uid = getUID();
  if (uid != null) {
    pref = child(sessionRef(sessionID, "patients"), uid);
    if (typeof path === "string") pref = child(pref, path);
  }
  return pref;
}

export async function getSession(sessionID, path) {
  let sref = sessionRef(sessionID, path);
  let sc = await get(sref);
  return sc.val();
}
export async function getPatient(sessionID, path) {
  let pref = patientRef(sessionID, path);
  let sc = await get(pref);
  return sc.val();
}
export async function getUserData(path) {
  let uref = usersRef(path);
  console.log(uref);
  let sc = await get(uref);
  return sc.val();
}

export async function setSession(sessionID, path, value) {
  let sref = sessionRef(sessionID, path);
  await set(sref, value);
}
export async function setPatient(sessionID, path, value) {
  let pref = patientRef(sessionID, path);
  await set(pref, value);
}
export async function setUserData(path, value) {
  let uref = usersRef(path);
  await set(uref, value);
}

export function onValueSession(sessionID, path, value) {
  let sref = sessionRef(sessionID, path);
  return onValue(sref, value);
}
export function onValuePatient(sessionID, path, value) {
  let pref = patientRef(sessionID, path);
  return onValue(pref, value);
}
export function onValueUserData(path, value) {
  let uref = usersRef(path);
  return onValue(uref, value);
}

function getNewSessionKey(){
  let pref = push(ref(Database, "sessions"));
  let sessionKey = pref.key;
  return sessionKey;
}


export function login(){
  const provider = new GoogleAuthProvider();
  console.log(Auth);
  signInWithRedirect(Auth, provider);
}

export function logout(){
  Auth.signOut();
}


export async function isCreator() {
  let value = null;
  try {
    value = await getUserData("creator");
  } catch (e) {
  }
  return value !== null
}

export async function isOwner(sessionID) {
  let res = false;
  try {
    let uid = getUID();
    let owner = await getSession(sessionID, "owner");
    res = uid === owner && uid !== null;
  } catch(e) {}
  return res;
}


export async function removeCurrentSession() {
  let session = await getUserData("info/current-session")
  if (session) {
    await setSession(session, null, null);
    await setUserData("info/current-session", null);
  }
}

//

export async function createSession(file, progressCallback, dummy = true) {
  if (User == null) {
    throw 'No user was found.';
  }
  let uid = User.uid;
  let sessionKey = getNewSessionKey();

  // remove old session
  try {
    await removeCurrentSession();
  } catch(e) {
    console.log(e);
    throw 'You do not have the privileges to create a sessions'
  }

  try {
    await setSession(sessionKey, null, {
      owner: uid,
    });
    // set users current session
    await setUserData("info/current-session", sessionKey);
  } catch (e) {
    console.log(e);
    throw 'You do not have the privileges to create a sessions'
  }

  // upload session content
  try {
    let url = "dummy";
    console.log(dummy);
    if (!dummy) {
      url = await uploadFileToCloud(file, uid, (info) => {
        let progress = info.bytesTransferred / info.totalBytes;
        if (progressCallback instanceof Function) {
          progressCallback(progress);
        }
      }, App);
    }
    await setSession(sessionKey, 'info/pdf', {
      url: url,
      page: 1,
    });
  } catch(e) {
    throw 'The session content failed to upload. Please try again and check your internet connection.'
  }

  // return session key
  return sessionKey;
}

export async function sendRequest(info){
  try {
    await setUser("info", info);
  } catch(e) {
    console.log(e);
  }
}

initializeFirebase();
