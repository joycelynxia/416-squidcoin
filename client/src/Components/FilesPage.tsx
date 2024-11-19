import React, { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import PublishIcon from '@mui/icons-material/Publish';
import DeleteIcon from '@mui/icons-material/Delete';
import { 
  Box, 
  Button, 
  Typography, 
  List, 
  ListItem, 
  Switch,
  IconButton,
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  ListItemText,
  LinearProgress,
} from "@mui/material";
import { useTheme } from '@mui/material/styles';
import { FileMetadata } from "../models/fileMetadata";
//import { FileMetadata } from '../../local_server/models/file';

declare global {
  interface Window {
      electron: {
          ipcRenderer: typeof import('electron').ipcRenderer;
          saveFile: (fileData: { fileName: string, fileData: Buffer }) => Promise<{ success: boolean, message: string }>;
      };
  }
}
// import { saveFileMetadata, getFilesForUser, deleteFileMetadata, updateFileMetadata, FileMetadata } from '../utils/localStorage'

// user id/wallet id is hardcoded for now

const drawerWidth = 300;
const collapsedDrawerWidth = 100;

const ipcRenderer = window.electron?.ipcRenderer;

interface FilesProp {
  uploadedFiles: FileMetadata[];
  setUploadedFiles: React.Dispatch<React.SetStateAction<FileMetadata[]>>;
  initialFetch: boolean;
  setInitialFetch: React.Dispatch<React.SetStateAction<boolean>>;
}

const FilesPage: React.FC<FilesProp> = ({uploadedFiles, setUploadedFiles, initialFetch, setInitialFetch}) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [descriptions, setDescriptions] = useState<{ [key: string]: string }>({}); // Track descriptions
  const [fileHashes, setFileHashes] = useState<{ [key: string]: string }>({}); // Track hashes
  // const [uploadedFiles, setUploadedFiles] = useState<FileMetadata[]>([]);
  const [notification, setNotification] = useState<{ open: boolean; message: string; severity: "success" | "error" }>({ open: false, message: "", severity: "success" });
  const [publishDialogOpen, setPublishDialogOpen] = useState(false); // Control for the modal
  const [currentFileHash, setCurrentFileHash] = useState<string | null>(null); // Track the file being published
  const [fees, setFees] = useState<{ [key: string]: number }>({}); // Track fees of to be uploaded files
  const theme = useTheme();
  const [loading, setLoading] = useState(false); // Loading state for file upload

  useEffect(() => {
    if (!initialFetch) {
      const fetchFiles = async () => {
        try {
          console.log("Getting local user's uploaded files");
          const response = await fetch("http://localhost:8081/files/fetchAll");
          if (!response.ok) throw new Error("Failed to load file data");
  
          const data = await response.json();
          console.log("Fetched data", data);
  
          setUploadedFiles(data); // Set the state with the loaded data
          setInitialFetch(true); // Set initialFetch to true to prevent further calls
        } catch (error) {
          console.error("Error fetching files:", error);
        }
      };
  
      fetchFiles();
    }
  }, [initialFetch, setUploadedFiles, setInitialFetch]);
  

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const fileArray = Array.from(files);
      setSelectedFiles(prevSelectedFiles => [...prevSelectedFiles, ...fileArray]);
      // Compute hashes for each file
      fileArray.forEach(file => computeSHA256(file));
    }
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;
    setLoading(true);
    try {
        // Create uploaded file objects with descriptions, hashes, and metadata
        const newUploadedFiles = await Promise.all(
            selectedFiles.map(async (file) => {
                // const fileData = await file.arrayBuffer(); // Read file as ArrayBuffer
                // const base64FileData = btoa(String.fromCharCode(...new Uint8Array(fileData))); // Convert to Base64
                // setPublishDialogOpen(true);
                console.log("start of loop");
                const arrayBuffer = await file.arrayBuffer();
                const fileData = new String(arrayBuffer);
                console.log("after reading file data");
                console.log("Filename is ", file.name, "fileData is ", fileData);
                const saveResponse = await window.electron.saveFile({
                  fileName: file.name,
                  fileData: Buffer.from(arrayBuffer),
              });
                
                console.log("Before saveresponse");
                if(!saveResponse.success)
                {
                  console.log("save error error error");
                }
                console.log("after save error response");
                let metadata:FileMetadata = {
                  //id: `${file.name}-${file.size}-${Date.now()}`, // Unique ID for the uploaded file
                  Name: file.name,
                  Type: file.type,
                  Size: file.size,
                  // file_data: base64FileData, // Encode file data as Base64 if required
                  Description: descriptions[file.name] || "",
                  Hash: fileHashes[file.name], // not needed - computed on backend
                  IsPublished: true, // Initially published
                  Fee: fees[file.name] || 0,
                  // Path: file.path,
                };
                
                // Send the metadata to the server
                const response = await fetch("http://localhost:8081/files/upload", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(metadata),
                });
                console.log("body is ",JSON.stringify(metadata));
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.text();
                console.log("File upload successful:", data, metadata);
                
                return metadata;
            })
        );

        // Update uploadedFiles state
        setUploadedFiles((prev) => [...prev, ...newUploadedFiles]);

        // Clear selected files, descriptions, and hashes after successful upload
        setSelectedFiles([]);
        setDescriptions({});
        setFees({});
        setFileHashes({});

        // Show success notification
        setNotification({ open: true, message: "Files uploaded successfully!", severity: "success" });
    } catch (error) {
        console.error("Error uploading files:", error);

        // Show error notification
        setNotification({ open: true, message: "Failed to upload files.", severity: "error" });
    } finally {
      setLoading(false);
    }
};

  const handleDescriptionChange = (fileId: string, description: string) => {
    if (!loading) {
      setDescriptions((prev) => ({ ...prev, [fileId]: description }));
    }
  };

  const handleFeeChange = (fileId: string, fee: number) => {
    setFees((prev) => ({ ...prev, [fileId]: fee }));
  };

// have to fix deleting file
  const handleDeleteUploadedFile = async (hash: string) => {
    try {
      const response = await fetch(`http://localhost:8081/files/delete?hash=${hash}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete file")
      }
      const data = await response.json();
      console.log('file deleted successfully', data);

      setUploadedFiles((prev) => prev.filter((file) => file.Hash !== hash));
      setSelectedFiles((prev) => prev.filter((file) => file.name !== hash));
      setNotification({ open: true, message: "File deleted.", severity: "success" });
    } catch (error) {
      console.error("error: ", error);
      setNotification({ open: true, message: "failed to delete file.", severity: "error" });

    }
  }

  const handleCloseNotification = () => {
    setNotification({ ...notification, open: false });
  };

  const handleUploadClick = () => {
    document.getElementById("file-input")?.click();
  };

  const computeSHA256 = async (file: File) => {
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray
      .map(byte => byte.toString(16).padStart(2, "0"))
      .join("");
    
    setFileHashes(prevHashes => ({
      ...prevHashes,
      [file.name]: hashHex,
    }));
  };

  const handleConfirmPublish = async (hash: string) => {
    const fileToPublish = uploadedFiles.find(file => file.Hash === hash);
    
    if (!fileToPublish) {
        setNotification({ open: true, message: "File not found", severity: "error" });
        return;
    }
    console.log("old metadata: ", fileToPublish)

    const updatedMetadata = {
      ...fileToPublish,
      IsPublished: !fileToPublish.IsPublished,
    };

    console.log("updated metadata: ", updatedMetadata)

    try {
        const response = await fetch("http://localhost:8081/files/upload", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(updatedMetadata),
        });

        if (response.ok) {
            // Update the file's published status locally in the UI
            setUploadedFiles(prevFiles => 
              prevFiles.map(currentFile =>
                currentFile.Hash === hash
                  ? { ...currentFile, IsPublished: !currentFile.IsPublished }
                  : currentFile
              )
            );
            setNotification({ open: true, message: "File published successfully!", severity: "success" });

            const data = await response.text();
            console.log("Publish response: ", data);
        } else {
            const errorData = await response.text();
            console.error("Publish response error:", errorData);
            setNotification({ open: true, message: "Failed to publish file", severity: "error" });
        }
    } catch (error) {
        console.error("Error publishing file:", error);
        setNotification({ open: true, message: "An error occurred", severity: "error" });
    } finally {
        console.log("Published file:", updatedMetadata);
        // setPublishDialogOpen(false);
    }
};

  const handleDeleteSelectedFile = (hash: string) => {
    setSelectedFiles((prev) => prev.filter((file) => file.name !== hash));
  }


  return (
      <Box
        sx={{
          padding: 2,
          marginTop: '70px',
          marginLeft: `${drawerWidth}px`, 
          transition: 'margin-left 0.3s ease',
          [theme.breakpoints.down('sm')]: {
            marginLeft: `${collapsedDrawerWidth}px`,
          },
        }}
      >
      <Sidebar />
      <Box sx={{ flexGrow: 1}}>
        <Typography variant="h4" gutterBottom>
          Import Files
        </Typography>
        <input
          type="file"
          id="file-input"
          multiple
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
        <Box 
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: 200,
            height: 200,
            border: '2px dashed #3f51b5',
            borderRadius: 2,
            cursor: 'pointer',
            marginBottom: 2,
            background: 'white',
            '&:hover': {
              backgroundColor: '#e3f2fd',
            },
          }}
          onClick={handleUploadClick} 
        >
          <PublishIcon sx={{ fontSize: 50 }} />
          <Typography variant="h6" sx={{ marginTop: 1 }}>
            Select Files
          </Typography>
        </Box>
        <Button 
          variant="contained" 
          onClick={handleUpload} 
          disabled={selectedFiles.length === 0}
        >
          Upload Selected
        </Button>
        
        {loading && <LinearProgress sx={{ width: '100%', marginTop: 2 }} />} {/* Progress bar when loading is true */}

        {selectedFiles.length > 0 && (
          <Box sx={{ marginTop: 2 }}>
            <Typography variant="h6">Selected Files:</Typography>
            <List>
              {selectedFiles.map((file, index) => (
                <ListItem key={index} divider>
                  <Box 
                    sx={{ 
                      display: 'flex', 
                      flexDirection: 'column', // Align text and input fields vertically
                      width: '100%', 
                    }}
                  >
                    {/* selected file details */}
                    <ListItemText
                      sx={{
                        width:'100%',
                        whiteSpace: 'normal',  // wrap text
                        wordBreak: 'break-word',
                        overflowWrap: 'break-word',
                      }}
                      primary={file.name}
                      secondary={
                        <>
                          {`Size: ${(file.size / 1024).toFixed(2)} KB`} <br />
                          {/* {`Description: ${(file.description)}`} <br /> */}

                          {`SHA-256 Hash: ${fileHashes[file.name] || "Computing..."}`}                       
                        </>
                      }  
                    />
                    
                    <Box sx={{ display: 'flex', flexDirection: 'column', marginTop: 1 }}>
                      <TextField
                        label="Description"
                        variant="outlined"
                        fullWidth
                        margin="normal"
                        value={descriptions[file.name] || ""}
                        onChange={(e) => handleDescriptionChange(file.name, e.target.value)}
                      />
                    </Box>

                    <Box sx={{ display: 'flex', flexDirection: 'column', marginTop: 1 }}>
                      <TextField
                        label="Fee"
                        type="number"
                        variant="outlined"
                        fullWidth
                        margin="normal"
                        value={fees[file.name] || 0}
                        onChange={(e) => handleFeeChange(file.name, parseFloat(e.target.value))}
                      />
                    </Box>

                  </Box>
                  <IconButton 
                      edge="end" 
                      aria-label="delete" 
                      onClick={() => handleDeleteSelectedFile(file.name)}
                      sx={{marginTop:15}}
                    >
                      <DeleteIcon />
                    </IconButton>
                </ListItem>
              ))}
            </List>
          </Box>
        )}
        
        {uploadedFiles.length > 0 && (
          <Box sx={{ marginTop: 4 }}>
            <Typography variant="h5" gutterBottom>
              Uploaded Files
            </Typography>
            <List>
              {uploadedFiles.map((file) => (
                <ListItem key={file.Hash} divider>
                  <ListItemText 
                    primary={file.Name} 
                    secondary={
                      <>
                        {`Size: ${(file.Size / 1024).toFixed(2)} KB`} <br />
                        {`Description: ${file.Description}`} <br />
                        {`SHA-256: ${file.Hash}`} <br />
                        {`Fee: ${file.Fee}`} <br />
                        </>
                    }                  
                    />
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Typography variant="body2" component="span" sx={{ marginRight: 1 }}>
                      Publish
                    </Typography>
                    <Switch 
                      edge="end" 
                      onChange={() => handleConfirmPublish(file.Hash)} 
                      checked={file.IsPublished} 
                      color="primary"
                      inputProps={{ 'aria-label': `make ${file.Name} public` }}
                    />
                    <IconButton edge="end" aria-label="delete" onClick={() => handleDeleteUploadedFile(file.Hash)}>
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                </ListItem>
              ))}
            </List>
          </Box>
        )}
      </Box>

      {/* Publish Modal */}
      {/* <Dialog open={publishDialogOpen} onClose={() => setPublishDialogOpen(false)}>
        <DialogTitle>Set Download Fee</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Enter Fee (in Squid Coins)"
            type="number"
            fullWidth
            variant="outlined"
            value={fee}

            onChange={(e) => setFee(Number(e.target.value))}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPublishDialogOpen(false)} color="secondary">
            Cancel
          </Button>
          <Button onClick={handleConfirmPublish} color="primary">
            Publish
          </Button>
        </DialogActions>
      </Dialog> */}

      {/* Notification Snackbar */}
      <Snackbar 
        open={notification.open} 
        autoHideDuration={6000} 
        onClose={handleCloseNotification}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseNotification} severity={notification.severity} sx={{ width: '100%' }}>
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default FilesPage;
