import {initializeApp} from 'https://www.gstatic.com/firebasejs/9.2.0/firebase-app.js'
import {getAuth, signInWithRedirect, GoogleAuthProvider, onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/9.2.0/firebase-auth.js'
import {getDatabase, child, push, ref, get, onValue, onChildAdded, onChildChanged, onChildRemoved, set, off} from 'https://www.gstatic.com/firebasejs/9.2.0/firebase-database.js'
import {uploadFileToCloud} from "./fileupload.js"

let UpdateHandlers = [];
function update(type, value) {
  for (let callback of UpdateHandlers) {
    callback(type, value);
  }
}
export function addUpdateHandler (callback) {
  if (callback instanceof Function) {
    UpdateHandlers.push(callback);
  }
}

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
  watchUser();

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

let UserDataWatcher = null;
function watchUser(){
  if (UserDataWatcher instanceof Function) {
    UserDataWatcher();
    UserDataWatcher = null;
  }
  UserDataWatcher = onValueUserData(null, (sc) => {
    update("user", sc.val());
  });
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
    try{
      await setSession(session, null, null);
    } catch (e) {
      // not owner of session
    }
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
    await setUserData("info", info);
  } catch(e) {
    console.log(e);
  }
}

// --------------------- session


let SID = null;
let IsPatient = true;
let Detatchers = [];
export async function joinSession(sessionID, patient){
  try {
    // console.log(sessionID);
    let pdf = await getSession(sessionID, "info/pdf");
    if (pdf == null) throw "Invalid session key"
  } catch (e) {
    console.log(e);
    throw "Invalid session";
  }

  let owner = await isOwner(sessionID);
  SID = sessionID;
  IsPatient = patient || !owner;
  for (let detatch of Detatchers) detatch();

  let detatchers = [
    onValueSession(SID, "info/pdf", (sc) => {
      update("pdf", sc.val());
    })
  ];

  if (IsPatient) {
    let moused = onValueSession(SID, "info/mouse", (sc) => {
      update("mouse", sc.val());
    });
    detatchers.push(moused);
  }

  if (!IsPatient) {
    let patientsd = onValueSession(SID, "patients", (sc) => {
      update("eyes", sc.val());
    })
    detatchers.push(patientsd)
  }

  setUserData("info/current-session", SID);

  Detatchers = detatchers;
}

export function leaveSession(){
  for (let detatcher of Detatchers) detatcher();
  Detatchers = [];
}

export const broadcast = {
   mouse: async function(position) {
     if (!IsPatient && SID) {
       try {
         if (position != null) {
           let {x, y} = position;
           position = {x, y}
         }
         await setSession(SID, "info/mouse", position);
       } catch (e) {}
     }
   },
   eye: async function(position) {
     if (SID) {
       try {
         if (position != null && typeof position === "object") {
           let {x, y} = position;
           position = {x, y}
         }
         await setPatient(SID, "eyes", position);
       } catch (e) {}
     }
   },
   page: async function(page) {
     if (!IsPatient && SID) {
       try {
         await setSession(SID, "info/pdf/page", page);
       } catch (e) {}
     }
   },
}


initializeFirebase();
