
import React, { useEffect, useState } from "react";
import { doc as fsDoc, getDoc } from "firebase/firestore";
import { getStorage, ref as storageRef, getDownloadURL } from "firebase/storage";
import { db } from "../firebase";


export default function SignedDocumentModalll({ id = "documentModal", doc = null }) {
  const [loading, setLoading] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [signatureUrl, setSignatureUrl] = useState(null);
  const [error, setError] = useState(null);


  const LOCAL_TEST_PDF = "/mnt/data/documenttest.png";

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      if (!doc) {
        setPdfUrl(null);
        setSignatureUrl(null);
        setError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      setPdfUrl(null);
      setSignatureUrl(null);

      try {
        // ---------- PDF ----------
        const documentId =
          doc.documentid ||
          doc.documentId ||
          doc.documentID ||
          doc.pdfDocumentId ||
          doc.document ||
          null;

        if (!documentId) {
          setPdfUrl(LOCAL_TEST_PDF);
        } else {
          const pdfRef = fsDoc(db, "pdfdocuments", documentId);
          const pdfSnap = await getDoc(pdfRef);

          if (!pdfSnap.exists()) {
            console.warn("PDF document not found for id:", documentId);
            setPdfUrl(LOCAL_TEST_PDF);
          } else {
            const pdfData = pdfSnap.data();
            const fileUrl =
              pdfData?.fileUrl ||
              pdfData?.fileURL ||
              pdfData?.fileurl ||
              pdfData?.url ||
              pdfData?.downloadUrl ||
              null;

            if (!fileUrl) {
              console.warn("pdfdocuments doc exists but missing fileUrl:", documentId, pdfData);
              setPdfUrl(LOCAL_TEST_PDF);
            } else {
              setPdfUrl(fileUrl);
            }
          }
        }

        const rawSig =
          doc.signaturelink ||
          doc.signatureLink ||
          doc.signatureUrl ||
          doc.signature ||
          doc.signature_path ||
          doc.signaturePath ||
          null;
          

        if (!rawSig) {
          setSignatureUrl(null);
        } else {
    
          if (rawSig.includes("alt=media")) {
            setSignatureUrl(rawSig);
          } else {
   
            let storagePath = null;
            try {
              const firebaseStorageIndicator = "/o/";
              if (rawSig.includes(firebaseStorageIndicator)) {
                
                const afterO = rawSig.split(firebaseStorageIndicator)[1] || "";
                const encodedPath = afterO.split("?")[0] || afterO;
                storagePath = decodeURIComponent(encodedPath); 
              } else {
              
                storagePath = rawSig;
              }
            } catch (e) {
              console.warn("Failed to parse signature storage path from:", rawSig, e);
              storagePath = rawSig;
            }

           
            try {
              const storage = getStorage();
              const sRef = storageRef(storage, storagePath);
              const downloadUrl = await getDownloadURL(sRef);
              if (!cancelled) setSignatureUrl(downloadUrl);
            } catch (e) {
              console.error("getDownloadURL failed for signature path:", storagePath, e);
            
              if (!cancelled) {
            
                setSignatureUrl(rawSig);
                
              }
            }
          }
        }

        if (!cancelled) setLoading(false);
      } catch (err) {
        console.error("SignedDocumentModalll load error:", err);
        if (!cancelled) {
          setError(err.message || String(err));
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, [doc]);

  return (
    <div>
      <div
        className="modal fade"
        id={id}
        data-bs-backdrop="static"
        data-bs-keyboard="false"
        tabIndex={-1}
        aria-hidden="true"
      >
        <div className="modal-dialog ">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Document Preview</h5>
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close" />
            </div>

            <div className="modal-body">
              {loading ? (
                <div className="p-3">Loading…</div>
              ) : error ? (
                <div className="p-3 text-danger">Error: {error}</div>
              ) : (
                <>
                
                  <div style={{ border: "1px solid #ddd", borderRadius: 6, overflow: "hidden" }}>
                    {pdfUrl ? (
                      <iframe
                        title="pdf-preview"
                        src={pdfUrl}
                        style={{
                          width: "100%",
                          height: "80vh",
                          border: 0,
                          display: "block",
                        }}
                      />
                    ) : (
                      <div className="p-4">PDF not found</div>
                    )}
                  </div>

                  <div className="mt-3">
                    <h5 className="fw-bold">Signature</h5>
                    {signatureUrl ? (
                      <img
                        src={signatureUrl}
                        alt="signature"
                        style={{
                          maxWidth: 200,
                          width: "100%",
                          objectFit: "contain",
                          border: "1px solid #ddd",
                          borderRadius: 6,
                          background: "#fff",
                          padding: 6,
                        }}
                        onError={(e) => {
                          console.error("Signature failed to load:", signatureUrl);
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    ) : (
                      <div style={{ color: "#666" }}>No signature available</div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="modal-footer border-0">
              <button className="btn btn-danger custom-red-bg fw-semibold " data-bs-dismiss="modal">
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
