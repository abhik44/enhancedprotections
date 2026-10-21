import { useEffect, useMemo, useState } from "react";
import Search from "../ui/Search";
import { db } from "../firebase";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import Spinner from "../ui/Spinner";
import { deleteDoc, doc } from "firebase/firestore";
import { HiTrash } from "react-icons/hi2";
import CreateDocumemtModal from "./CreateDocumentModal";
import { HiEye } from "react-icons/hi";
import styles from "./Document.module.css";

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
    {/* Page heading and actions */}
    <div className={`${styles.documentPageHeader} mb-3`}>
      <h3 className="text-4a mb-0">Documents</h3>

      <div className={styles.documentActions}>
        {/* Search bar */}
        <div className={styles.documentSearch}>
          <Search
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by document name or type"
          />
        </div>

        {/* Create Document button */}
        <button
          type="button"
          className={`btn custom-red-bg text-white fw-medium ${styles.createDocumentBtn}`}
          data-bs-toggle="modal"
          data-bs-target="#createDocument"
        >
          + Create Document
        </button>
      </div>
    </div>

    {loading ? (
      <div className={`${styles.documentTable} border border-2 rounded-4 p-3`}>
        <div className="text-custom-red text-center d-flex align-items-center justify-content-center gap-2">
          <Spinner colorSpinner="text-custom-red" />
          <span>Loading documents...</span>
        </div>
      </div>
    ) : filteredDocuments.length === 0 ? (
      <div className={`${styles.documentTable} border border-2 rounded-4 p-3`}>
        <div className="text-custom-red fw-bold text-center mb-0">
          No Documents Found :(
        </div>
      </div>
    ) : (
      <>
        {/* ================= Mobile: Cards ================= */}
        <div className={`${styles.mobileOnly} ${styles.cardList}`}>
          {filteredDocuments.map((doc) => (
            <div className={styles.card} key={doc.id}>
              {/* Top row: document name on the left, action icons on the right */}
              <div className={styles.cardTop}>
                <h6 className={styles.name}>{doc.documentName || "-"}</h6>

                <div className={styles.cardActions}>
                  {doc.fileUrl && (
                    <button
                      type="button"
                      className={styles.iconBtn}
                      title="View document"
                      aria-label={`View ${doc.documentName || "document"}`}
                      onClick={() => window.open(doc.fileUrl, "_blank", "noopener,noreferrer")}
                    >
                      <HiEye />
                    </button>
                  )}

                  <button
                    type="button"
                    className={styles.iconBtnDanger}
                    title="Delete"
                    aria-label={`Delete ${doc.documentName || "document"}`}
                    onClick={() => handleDelete(doc.id)}
                  >
                    <HiTrash />
                  </button>
                </div>
              </div>

              <dl className={styles.details}>
                <dt>Type</dt>
                <dd className="text-capitalize">{doc.documentType || "-"}</dd>
              </dl>
            </div>
          ))}
        </div>

        {/* ================= Desktop / tablet: Table ================= */}
        <div className={`${styles.desktopOnly} ${styles.documentTable} border border-2 rounded-4 p-3`}>
        <table className="table align-middle mb-0">
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
                <td className="text-capitalize">
                  {doc.documentType || "-"}
                </td>

                <td>
                  {doc.fileUrl && (
                    <button
                      type="button"
                      className="btn btn-link text-black p-0 border-0"
                      title="View document"
                      aria-label={`View ${doc.documentName || "document"}`}
                      onClick={() =>
                        window.open(doc.fileUrl, "_blank", "noopener,noreferrer")
                      }
                    >
                      <HiEye />
                    </button>
                  )}
                </td>

                <td>
                  <button
                    type="button"
                    className="btn btn-link text-danger p-0 border-0"
                    aria-label={`Delete ${doc.documentName || "document"}`}
                    onClick={() => handleDelete(doc.id)}
                  >
                    <HiTrash />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </>
    )}

    {/* Document Modal */}
    <CreateDocumemtModal />
  </>
);

}

export default Document;
