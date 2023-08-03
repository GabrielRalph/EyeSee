import {getStorage, ref, uploadBytes, uploadBytesResumable, getDownloadURL} from 'https://www.gstatic.com/firebasejs/9.2.0/firebase-storage.js'


// Upload file to firebase storage bucket
async function uploadFileToCloud(file, path, statusCallback, App){
  console.log("HERE");
  let Storage = getStorage(App, "gs://eyesee-d0a42.appspot.com");
  // path = `${path}`
  console.log("uploading file of size", (file.size/1e6) + "MB");

  if ( !(file instanceof File) || typeof path !== 'string' ){
    console.log('invalid file');
    return null;
  }


  let sref = ref(Storage, path);
  console.log(sref);

  let uploadTask = uploadBytesResumable(sref, file);
  console.log(uploadTask);
  uploadTask.on('next', statusCallback)
  await uploadTask;

  let url = await getDownloadURL(sref);
  return url;
}


export {uploadFileToCloud}
