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

function sessionRef(sessionID, childKey) {
  let sref = null;
  if (Database != null) {
    sref = ref(Database, "sessions/" + sessionID);
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
async function isOwner(sessionID){
  let owner = null;
  try {
    owner = (await get(sessionRef(sessionID, "owner"))).val();
  } catch(e) {
    console.log(e);
    owner = null;
  }
  if (owner !== null) {
    owner = owner == getUID();
  }
  return owner;
}

function initializeFirebase(config = firebaseConfig) {
  App = initializeApp(config);
  Database = getDatabase(App);
  Auth = getAuth();
  onAuthStateChanged(Auth, (userData) => {
    if (userData == null) {
      authChange(userData);
    } else {
      if (!(User != null && User.uid === userData.uid)) {
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
function getApp(){return App}


function addAuthChangeListener(obj) {
  StateListeners.push(obj);
}

function login(){
  const provider = new GoogleAuthProvider();
  console.log(Auth);
  signInWithRedirect(Auth, provider);
}

function logout(){
  Auth.signOut();
}


async function makeSession() {
  let sessionID = null;
  try {
    sessionID = getUID();
    if (!isOwner(sessionID)) {
      let session = {
        "owner": sessionID,
      }
      let sref = sessionRef(sessionID);
      await set(sref, session);
    }
  } catch(e) {
    console.log(e);
    sessionID = null;
  }
  return sessionID;
}


function joinSessionAsOwner(sessionID, sessionObj) {
  // update session info
  sessionObj.updateMousePosition = async (pos) => {
    try {
      let {x, y} = pos;
      await set(sessionRef(sessionID, "info/mouse"), {x, y})
      return true;
    } catch (e) {
      console.log(e);
      return false;
    }
  }

  // watch for changes in patients directory
  let stop = onValue(sessionRef(sessionID, "patients"), (patients) => {
    if (sessionObj.patientUpdate instanceof Function) {
      sessionObj.patientUpdate(patients.val());
    }
  });

  let stop2 = onValue(sessionRef(sessionID, "info/pdf"), (sc) => {
    if (sessionObj.PDFUpdate instanceof Function) {
      sessionObj.PDFUpdate(sc.val());
    }
  });


  sessionObj.leaveSession = () => {
    stop();
    stop2();
    sessionObj.updateMousePosition = null;
  }

  sessionObj.isSessionOwner = true;
}

async function joinSessionAsPatient(sessionID, sessionObj) {
  sessionObj.updateEyePosition = async (pos) => {
    try {
      let {x, y} = pos;
      await set(patientRef(sessionID), {x, y});
      return true;
    } catch(e) {
      console.log(e);
      return false;
    }
  }
  // watch for changes in info call session update on change
  let stop = onValue(sessionRef(sessionID, "info/mouse"), (info) => {
    info = info.val();
    if (sessionObj.mouseUpdate instanceof Function) {
      sessionObj.mouseUpdate(info);
    }
  });
  let stop2 = onValue(sessionRef(sessionID, "info/pdf"), (info) => {
    info = info.val();
    if (info && sessionObj.PDFUpdate instanceof Function) {
      sessionObj.PDFUpdate(info);
    }
  });

  sessionObj.unsubscribeSession = () => {
    stop();
    stop2();
    sessionObj.updateEyePosition = null;
  }
  sessionObj.isSessionOwner = false;

}

// join a session
async function joinSession(sessionID, sessionObj = {}, forcePatient = false) {
  if (typeof sessionObj !== "object" || sessionObj === null) sessionObj = {};

  if (sessionObj.unsubscribeSession instanceof Function) sessionObj.unsubscribeSession;

  let isowner = await isOwner(sessionID);
  if (isowner !== null) {
    if (isowner && !forcePatient) {
      joinSessionAsOwner(sessionID, sessionObj);
      console.log("session joined as owner");
    } else {
      joinSessionAsPatient(sessionID, sessionObj);
      console.log("session joined as patient");

    }
  } else {
    sessionObj = null;
  }

  return sessionObj;
}

async function uploadPDF(sessionID, statusCallback) {
  let input = document.createElement("input");
  input.type = "file";
  input.accept = ".pdf";

  return new Promise((resolve, reject) => {
    input.oninput = async () => {
      let file = input.files[0];
      console.log("FILE FOUND ", file);
      try {
        console.log("here");
        let url = await uploadFileToCloud(file, sessionID, statusCallback, App);
        console.log(url);
        await set(sessionRef(sessionID, "info/pdf"), {
          url: url,
          page: 1,
        })
        resolve(true);
      } catch(e) {
        console.log(e);
        resolve(false);
      }
    }
    input.click();
  });
}

initializeFirebase();

export {addAuthChangeListener, login, logout, makeSession, joinSession, getApp, set, sessionRef, uploadPDF}
