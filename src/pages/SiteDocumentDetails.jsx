import { useEffect, useMemo, useState } from "react";
import Search from "../ui/Search";
import Spinner from "../ui/Spinner";
import { db } from "../firebase";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { useParams } from "react-router-dom";
import { HiEye } from "react-icons/hi";
import CreateSiteDocumentModal from "./CreateSiteDocumentModal";

function SiteDocumentDetails() {
  const { siteId } = useParams();

  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // fetch site documents
  useEffect(() => {
    setLoading(true);

    const q = query(collection(db, "sitedocuments"), where("siteId", "==", siteId), orderBy("createdAt", "desc"));

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
        console.error("Error fetching site documents", error);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [siteId]);

  // search filter
  const filteredDocuments = useMemo(() => {
    const q = (searchTerm || "").trim().toLowerCase();
    if (!q) return documents;

    return documents.filter((d) => {
      const name = (d.documentName || "").toLowerCase();
      const type = (d.documentType || "").toLowerCase();

      return name.includes(q) || type.includes(q);
    });
  }, [documents, searchTerm]);

  return (
    <>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-3 gap-5">
        <h3 className="text-4a">Site Documents</h3>

        <div className="d-flex gap-4 justify-content-end">
          <div style={{ width: "400px" }}>
            <Search value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search document..." />
          </div>

          <div>
            <button type="button" className="btn custom-red-bg text-white fw-medium" data-bs-toggle="modal" data-bs-target="#createSiteDocument">
              + Create Document
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="border border-2 rounded-4 p-3">
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
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {filteredDocuments.map((doc) => (
                <tr key={doc.id}>
                  <td>{doc.documentName || "-"}</td>

                  <td>
                    {doc.fileUrl && (
                      <button type="button" className="btn btn-link text-black ps-3 p-0 border-0" title="View document" onClick={() => window.open(doc.fileUrl, "_blank")}>
                        <HiEye />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      <CreateSiteDocumentModal siteId={siteId} />
    </>
  );
}

export default SiteDocumentDetails;
