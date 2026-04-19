import { useEffect, useMemo, useState } from "react";
import Search from "../ui/Search";
import { db } from "../firebase";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import Spinner from "../ui/Spinner";
import { deleteDoc, doc } from "firebase/firestore";
import { HiTrash } from "react-icons/hi2";
import CreateDocumemtModal from "./CreateDocumentModal";
import { HiEye } from "react-icons/hi";

function Document() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  // serach by document name
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    setLoading(true);

    const q = query(collection(db, "pdfdocuments"), orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setDocuments(data);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching documents", error);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);
  const handleDelete = async (documentid) => {
    const confirmDelete = window.confirm("Are you sure you want to delete this document?");

    if (!confirmDelete) return;

    try {
      await deleteDoc(doc(db, "pdfdocuments", documentid));
    } catch (err) {
      console.error("Error deleting document:", err);
      alert("Failed to delete document");
    }
  };

  // filter / Search by name or type

  const filteredDocuments = useMemo(() => {
    const q = (searchTerm || "").trim().toLowerCase();
    if (!q) return documents;

    return documents.filter((d) => {
      const name = (d.documentName || "").toLowerCase();
      const type = (d.documentType || "").toLowerCase();

      const matchByName = name.includes(q);

      const matchByType = type === q || type.startsWith(q);

      return matchByName || matchByType;
    });
  }, [documents, searchTerm]);

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3 gap-5">
        <h3 className="text-4a">Documents</h3>

        <div className="d-flex gap-4 justify-content-end">
          <div style={{ width: "500px" }}>
            <Search value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search by document name or type" />
          </div>

          <div>
            <button type="button" className="btn custom-red-bg text-white fw-medium " data-bs-toggle="modal" data-bs-target="#createDocument">
              + Create Document
            </button>
          </div>
        </div>
      </div>

      {/* document table */}

      <div className="documentTable border border-2 rounded-4 p-3">
        {loading ? (
          <div className="text-custom-red text-center d-flex align-items-center justify-content-center gap-2">
            <Spinner colorSpinner="text-custom-red" />
            <span>Loading documents...</span>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="text-custom-red fw-bold text-center mb-0">No Documents Found :(</div>
        ) : (
          <table className="table">
            <thead className="table-light">
              <tr>
                <th>Document Name</th>
                <th>Document Type</th>
                <th>Action</th>
                <th>Delete</th>
              </tr>
            </thead>

            <tbody>
              {filteredDocuments.map((doc) => (
                <tr key={doc.id}>
                  <td>{doc.documentName || "-"}</td>
                  <td className="text-capitalize">{doc.documentType || "-"}</td>

                  <td>
                    {doc.fileUrl && (
                      <button type="button" className="btn btn-link text-black ps-3 p-0 border-0 " title="View document" onClick={() => window.open(doc.fileUrl, "_blank")}>
                        <HiEye />
                      </button>
                    )}
                  </td>
                  <td>
                    <button className="btn btn-link text-danger  p-0 border-0" onClick={() => handleDelete(doc.id)}>
                      <HiTrash />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Document Modal */}
      <CreateDocumemtModal />
    </>
  );
}

export default Document;
