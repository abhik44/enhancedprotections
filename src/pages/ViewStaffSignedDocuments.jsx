
import { useEffect, useState } from "react";
import { HiEye } from "react-icons/hi";
import { collection, query, onSnapshot, where } from "firebase/firestore";
import { db } from "../firebase";
import SignedDocumentModalll from "./SignedDocumentModalll";
import { useLocation } from "react-router-dom";

export default function ViewStaffSignedDocuments() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState(null);

  const { state } = useLocation();
  const staffId = state?.staffId;

  useEffect(() => {
    setLoading(true);
    if (!staffId) {
      setRows([]);
      setLoading(false);
      return;
    }

    const q = query(collection(db, "signeddocuments"), where("staffid", "==", staffId));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setRows(data);
        setLoading(false);
      },
      (err) => {
        console.error("Failed to load signed documents:", err);
        setRows([]);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [staffId]);


  useEffect(() => {
    const modalEl = document.getElementById("documentModal");
    if (!modalEl) return;

    const handler = () => setSelectedDoc(null);
    modalEl.addEventListener("hidden.bs.modal", handler);

    return () => modalEl.removeEventListener("hidden.bs.modal", handler);
  }, []);

  return (
    <>
      <div className="signedStaffTable border border-2 rounded-4 p-3">
        <table className="table">
          <thead className="table-light">
            <tr>
              <th>Document Name</th>
              <th>Signed On</th>
              <th>View</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={3} className="text-center p-4">Loading...</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="text-center p-4">No signed documents found</td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.documentName || r.documentId || "Document"}</td>
                  <td>
                    {r.signedon
                      ? (typeof r.signedon === "object" && r.signedon?.toDate
                          ? r.signedon.toDate().toLocaleString()
                          : new Date(r.signedon).toLocaleString())
                      : "-"}
                  </td>
                  <td className="ps-3">
                    <button
                      type="button"
                      className="btn btn-link p-0 border-0 text-black"
                      data-bs-toggle="modal"
                      data-bs-target="#documentModal"
                      title="View signed document"
                      onClick={() => setSelectedDoc(r)}
                    >
                      <HiEye />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

    
      <SignedDocumentModalll id="documentModal" doc={selectedDoc} />
    </>
  );
}
