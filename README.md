# EgloTFS
Temporary file storage for downloading files

# How to use
Just run with the current Dockerfile and set ENV's to this

MONGODB_URI
KEY

The MONGODB_URI will be your connection string to the database, eg: mongodb://10.0.0.1:10001
and the KEY will be your authentication for uploading files, so set it to a password or something secure

# How to upload files
To upload send a POST request like this:

http://localhost:3000/upload?key=somekey

The key is the key that you set in the ENV file

# How to download files
To download files you need to make a GET request to the server, like this:

http://localhost:3000/download?id=someid

You will get the ID after you upload a file, it will be returned in JSON format, like this:

{status: "OK", id: "someid"}

# FILES ARE DELETED
This is a temporary file storage, 30 minutes after the file is uploaded it is deleted (within 5 mins)
