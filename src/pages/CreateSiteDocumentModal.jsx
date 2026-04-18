import { useEffect, useRef, useState } from "react";
import styles from "./CreateStaff.module.css";
import { db, storage } from "../firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import toast from "react-hot-toast";

export default function CreateSiteDocumentModal({ siteId }) {
  const modalId = "createSiteDocument"; // ✅ DIFFERENT ID
  const modalRef = useRef(null);

  const [form, setForm] = useState({
    documentName: "",
    documentType: "",
  });

  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef(null);

  useEffect(() => {
    modalRef.current = document.getElementById(modalId);
  }, []);

  const handleChange = (e) => {
    const { id, value } = e.target;
    setForm((s) => ({ ...s, [id]: value }));
  };

  const hideBootstrapModal = () => {
    const el = modalRef.current;
    if (!el) return;

    const bs = window.bootstrap;
    if (!bs) {
      el.classList.remove("show");
      el.setAttribute("aria-hidden", "true");
      el.style.display = "none";
      document.querySelectorAll(".modal-backdrop").forEach((b) => b.remove());
      return;
    }

    let inst = bs.Modal.getInstance(el);
    if (!inst) inst = new bs.Modal(el);
    inst.hide();
  };

  const resetForm = () => {
    setForm({
      documentName: "",
      documentType: "",
    });

    setFile(null);
    setSaving(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClose = () => {
    resetForm();
  };

  const handleSave = async () => {
    if (!form.documentName.trim()) {
      toast.error("Please enter a document name.");
      return;
    }

    if (!file) {
      toast.error("Please choose a PDF file.");
      return;
    }

    if (!siteId) {
      toast.error("Site not found.");
      return;
    }

    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      toast.error("Only PDF files are allowed");
      return;
    }

    setSaving(true);

    try {
      // upload file
      const storageRef = ref(storage, `sitedocuments/${siteId}/${Date.now()}-${file.name}`);

      const upload = await uploadBytes(storageRef, file);
      const url = await getDownloadURL(upload.ref);

      // save to firestore
      await addDoc(collection(db, "sitedocuments"), {
        siteId: siteId, // 🔥 IMPORTANT
        documentName: form.documentName.trim(),
        documentType: "information",
        fileUrl: url,
        createdAt: serverTimestamp(),
      });

      toast.success("Document uploaded successfully");
      hideBootstrapModal();
      resetForm();
    } catch (e) {
      console.error("Error saving document:", e);
      toast.error("Failed to save document: " + (e.message || e));
      setSaving(false);
    }
  };

  return (
    <div className="modal fade" id={modalId} tabIndex="-1" aria-labelledby={modalId} aria-hidden="true" data-bs-backdrop="static" data-bs-keyboard="false">
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header px-4">
            <h5 className="mb-0">Create Site Document</h5>

            <button type="button" className="btn-close" data-bs-dismiss="modal" onClick={handleClose} />
          </div>

          <div className="modal-body px-4">
            <form onSubmit={(e) => e.preventDefault()}>
              <div className="row">
                {/* Document name */}
                <div className="col-md-6 mb-3">
                  <label className="form-label fw-medium">Document Name</label>
                  <input id="documentName" className={`form-control ${styles.inputBox}`} value={form.documentName} onChange={handleChange} placeholder="Enter document name" />
                </div>

                {/* File */}
                <div className="col-md-12 mb-3">
                  <label className="form-label fw-medium">Choose Document</label>

                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    className={`form-control ${styles.inputBox}`}
                    ref={fileInputRef}
                    onChange={(e) => setFile(e.target.files[0] || null)}
                  />

                  <div className="form-text">Only PDF files are allowed.</div>
                </div>
              </div>
            </form>
          </div>

          <div className="modal-footer px-4 pb-4 border-0">
            <button type="button" className="btn btn-secondary px-3" data-bs-dismiss="modal" onClick={handleClose}>
              Close
            </button>

            <button type="button" className="btn btn-danger custom-red-bg text-white fw-medium px-3" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
