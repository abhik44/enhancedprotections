import { useEffect, useRef, useState } from "react";
import styles from "./CreateStaff.module.css";
import { db, storage } from "../firebase";
import { collection, addDoc, serverTimestamp, doc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import toast from "react-hot-toast";

export default function CreateStaffModal({ editingStaff, onClose }) {
  const modalId = "createStaff";
  const modalRef = useRef(null);

  const isEdit = Boolean(editingStaff);

  const [staff, setStaff] = useState({
    firstname: "",
    lastname: "",
    email: "",
    password: "",
    phone: "",
    profilePic: null,
  });

  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  //   till here done next

  useEffect(() => {
    modalRef.current = document.getElementById(modalId);
  }, []);

  useEffect(() => {
    if (editingStaff) {
      setStaff({
        firstname: editingStaff.firstname || "",
        lastname: editingStaff.lastname || "",
        email: editingStaff.email || "",
        password: "",
        phone: editingStaff.phone || "",
        profilePic: editingStaff.profilePic || null,
      });
    } else {
      resetForm();
    }
  }, [editingStaff]);

  const handleChange = (e) => setStaff({ ...staff, [e.target.id]: e.target.value });

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
    setStaff({
      firstname: "",
      lastname: "",
      email: "",
      password: "",
      phone: "",
      profilePic: null,
    });
    setFile(null);
    setLoading(false);
  };

  const handleClose = () => {
    resetForm();
    onClose?.();
  };

  const handleSubmit = async () => {
    if (!staff.firstname || !staff.lastname || !staff.email) {
      toast.error("Please fill all required fields");
      return;
    }

    if (!isEdit && !staff.password) {
      toast.error("Password is required");
      return;
    }

    setLoading(true);

    try {
      let imageUrl = staff.profilePic || null;

      if (file) {
        const storageRef = ref(storage, `staff/${Date.now()}-${file.name}`);
        const upload = await uploadBytes(storageRef, file);
        imageUrl = await getDownloadURL(upload.ref);
      }

      if (isEdit && editingStaff?.id) {
        // update
        const refDoc = doc(db, "staff", editingStaff.id);
        await updateDoc(refDoc, {
          firstname: staff.firstname,
          lastname: staff.lastname,
          email: staff.email,
          password: staff.password,
          phone: staff.phone || null,
          profilePic: imageUrl || null,
          updatedAt: serverTimestamp(),
        });
        toast.success("Staff Updated Successfully");
      } else {
        // create
        await addDoc(collection(db, "staff"), {
          firstname: staff.firstname,
          lastname: staff.lastname,
          email: staff.email,
          password: staff.password,
          phone: staff.phone || null,
          profilePic: imageUrl || null,
          createdAt: serverTimestamp(),
        });
        toast.success("Staff Created Successfully");
      }

      hideBootstrapModal();
      handleClose();
    } catch (err) {
      console.error("Create/update staff error:", err);
      toast.error("Failed to save staff: " + (err.message || err));
      setLoading(false);
    }
  };

  return (
    <div className="modal fade" id={modalId} tabIndex="-1" aria-labelledby={modalId} aria-hidden="true" data-bs-backdrop="static" data-bs-keyboard="false">
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header px-4">
            <h5 className="mb-0">{isEdit ? "Edit Staff" : "Create Staff"}</h5>
            <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close" onClick={handleClose} />
          </div>

          <div className="modal-body px-4">
            <form onSubmit={(e) => e.preventDefault()}>
              <div className="row">
                <div className="col-md-4 mb-3">
                  <label className="form-label fw-medium">First Name</label>
                  <input id="firstname" className={`form-control ${styles.inputBox}`} value={staff.firstname} onChange={handleChange} />
                </div>

                <div className="col-md-4 mb-3">
                  <label className="form-label fw-medium">Last Name</label>
                  <input id="lastname" className={`form-control ${styles.inputBox}`} value={staff.lastname} onChange={handleChange} />
                </div>

                <div className="col-md-4 mb-3">
                  <label className="form-label fw-medium">Email</label>
                  <input id="email" type="email" className={`form-control ${styles.inputBox}`} value={staff.email} onChange={handleChange} />
                </div>

                <div className="col-md-4 mb-3">
                  <label className="form-label fw-medium">Password {isEdit && <span className="text-muted">(optional)</span>}</label>
                  <input id="password" type="password" className={`form-control ${styles.inputBox}`} value={staff.password} onChange={handleChange} />
                </div>

                <div className="col-md-4 mb-3">
                  <label className="form-label fw-medium">Phone</label>
                  <input id="phone" className={`form-control ${styles.inputBox}`} value={staff.phone} onChange={handleChange} />
                </div>

                <div className="col-md-4 mb-3">
                  <label className="form-label fw-medium">Choose Profile</label>
                  <input type="file" className={`form-control ${styles.inputBox}`} onChange={(e) => setFile(e.target.files[0])} />
                  {isEdit && staff.profilePic && (
                    <div className="mt-3 d-flex align-items-center gap-2">
                      <span className="small text-muted">Current :</span>
                      <img
                        src={staff.profilePic}
                        alt="profile"
                        width="40"
                        height="40"
                        style={{
                          borderRadius: "50%",
                          objectFit: "cover",
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </form>
          </div>

          <div className="modal-footer px-4 pb-4 border-0">
            <button type="button" className="btn btn-secondary fw-medium" data-bs-dismiss="modal" onClick={handleClose}>
              Cancel
            </button>
            <button type="button" className="btn btn-danger text-white fw-medium" onClick={handleSubmit} disabled={loading}>
              {loading ? "Saving..." : isEdit ? "Update" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
