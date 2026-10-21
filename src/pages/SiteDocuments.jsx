import { useEffect, useMemo, useState } from "react";
import Search from "../ui/Search";
import Spinner from "../ui/Spinner";
import { db } from "../firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { HiEye } from "react-icons/hi";
import { useNavigate } from "react-router-dom";
import styles from "./SiteDocument.module.css";

function SiteDocuments() {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const navigate = useNavigate();

  // fetch sites
  useEffect(() => {
    setLoading(true);

    const coll = collection(db, "sites");

    const unsub = onSnapshot(
      coll,
      (snapshot) => {
        const items = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        setSites(items);
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching sites", err);
        setSites([]);
        setLoading(false);
      },
    );

    return () => unsub();
  }, []);

  // filter sites
  const filteredSites = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return sites;

    return sites.filter((s) => (s.siteName || "").toLowerCase().includes(q));
  }, [sites, searchTerm]);

 
return (
  <>
    {/* Page heading and search */}
    <div className={`${styles.siteDocumentsHeader} mb-3`}>
      <h3 className="text-4a mb-0">Site Documents</h3>

      <div className={styles.siteDocumentsSearch}>
        <Search
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search site name..."
        />
      </div>
    </div>

    {loading ? (
      <div className={`${styles.siteDocumentsTable} border border-2 rounded-4 p-3`}>
        <div className="text-custom-red text-center d-flex align-items-center justify-content-center gap-2">
          <Spinner colorSpinner="text-custom-red" />
          <span>Loading sites...</span>
        </div>
      </div>
    ) : filteredSites.length === 0 ? (
      <div className={`${styles.siteDocumentsTable} border border-2 rounded-4 p-3`}>
        <div className="alert text-custom-red fw-bold text-center mb-0">
          No Sites Found :(
        </div>
      </div>
    ) : (
      <>
        {/* ================= Mobile: Cards ================= */}
        <div className={`${styles.mobileOnly} ${styles.cardList}`}>
          {filteredSites.map((s) => (
            <div className={styles.card} key={s.id}>
              {/* Top row: site name on the left, action icon on the right */}
              <div className={styles.cardTop}>
                <h6 className={styles.name}>{s.siteName ?? "-"}</h6>

                <div className={styles.cardActions}>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    title="View site documents"
                    aria-label={`View documents for ${s.siteName || "site"}`}
                    onClick={() => navigate(`/app/site-documents/${s.id}`)}
                  >
                    <HiEye />
                  </button>
                </div>
              </div>

              <dl className={styles.details}>
                <dt>Latitude</dt>
                <dd>{s.latitude ?? "-"}</dd>
                <dt>Longitude</dt>
                <dd>{s.longitude ?? "-"}</dd>
              </dl>
            </div>
          ))}
        </div>

        {/* ================= Desktop / tablet: Table ================= */}
        <div className={`${styles.desktopOnly} ${styles.siteDocumentsTable} border border-2 rounded-4 p-3`}>
        <table className="table align-middle mb-0">
          <thead className="table-light">
            <tr>
              <th>Site Name</th>
              <th>Latitude</th>
              <th>Longitude</th>
              <th>View Documents</th>
            </tr>
          </thead>

          <tbody>
            {filteredSites.map((s) => (
              <tr key={s.id}>
                <td>{s.siteName ?? "-"}</td>
                <td>{s.latitude ?? "-"}</td>
                <td>{s.longitude ?? "-"}</td>

                <td>
                  <button
                    type="button"
                    className="btn btn-link text-black p-0 border-0"
                    title="View site documents"
                    aria-label={`View documents for ${s.siteName || "site"}`}
                    onClick={() =>
                      navigate(`/app/site-documents/${s.id}`)
                    }
                  >
                    <HiEye />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </>
    )}
  </>
);

}

export default SiteDocuments;
