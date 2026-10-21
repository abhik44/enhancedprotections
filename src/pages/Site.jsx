import Search from "../ui/Search";
import { useEffect, useMemo, useState } from "react";
import CreateSiteModal from "./CreateSiteModal";
import { db } from "../firebase";
import { collection, onSnapshot } from "firebase/firestore";
import Spinner from "../ui/Spinner";
import { HiPencilSquare } from "react-icons/hi2";
import { deleteDoc, doc } from "firebase/firestore";
import { HiTrash } from "react-icons/hi2";
import styles from "./Site.module.css";

function Site() {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);

  // search state
  const [searchTerm, setSearchTerm] = useState("");

  // Editing state
  const [editingSite, setEditingSite] = useState(null);

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
        console.error("Failed to fetch sites", err);
        setSites([]);
        setLoading(false);
      },
    );
    return () => unsub();
  }, []);

  // Filter by sitename
  const handleDeleteSite = async (siteId) => {
    const confirmDelete = window.confirm("Are you sure you want to delete this site?");

    if (!confirmDelete) return;

    try {
      await deleteDoc(doc(db, "sites", siteId));
    } catch (err) {
      console.error("Error deleting site:", err);
      alert("Failed to delete site");
    }
  };
  const filteredSites = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return sites;

    return sites.filter((s) => (s.siteName || "").toLowerCase().includes(q));
  }, [searchTerm, sites]);

  // when clicking create site
  const handleOpenCreate = () => {
    setEditingSite(null);
  };

  const handleOpenEdit = (site) => {
    setEditingSite(site);
  };

  
return (
  <>
    {/* Page heading and actions */}
    <div className={`${styles.sitePageHeader} mb-3`}>
      <h3 className="text-4a mb-0">Sites</h3>

      <div className={styles.siteActions}>
        {/* Search bar */}
        <div className={styles.siteSearch}>
          <Search
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search site name.."
          />
        </div>

        {/* Create Site button */}
        <button
          type="button"
          className={`btn custom-red-bg text-white fw-medium ${styles.createSiteBtn}`}
          data-bs-toggle="modal"
          data-bs-target="#createSite"
          onClick={handleOpenCreate}
        >
          + Create Site
        </button>
      </div>
    </div>

    {/* Create Site Modal */}
    <CreateSiteModal
      editingSite={editingSite}
      onClose={() => setEditingSite(null)}
    />

    {loading ? (
      <div className={`${styles.siteTable} border border-2 rounded-4 p-3`}>
        <div className="text-custom-red text-center d-flex align-items-center justify-content-center gap-2">
          <Spinner colorSpinner="text-custom-red" />
          <span>Loading sites...</span>
        </div>
      </div>
    ) : filteredSites.length === 0 ? (
      <div className={`${styles.siteTable} border border-2 rounded-4 p-3`}>
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
              {/* Top row: site name on the left, action icons on the right */}
              <div className={styles.cardTop}>
                <h6 className={styles.name}>{s.siteName ?? "-"}</h6>

                <div className={styles.cardActions}>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    title="Edit"
                    aria-label={`Edit ${s.siteName || "site"}`}
                    data-bs-toggle="modal"
                    data-bs-target="#createSite"
                    onClick={() => handleOpenEdit(s)}
                  >
                    <HiPencilSquare />
                  </button>

                  <button
                    type="button"
                    className={styles.iconBtnDanger}
                    title="Delete"
                    aria-label={`Delete ${s.siteName || "site"}`}
                    onClick={() => handleDeleteSite(s.id)}
                  >
                    <HiTrash />
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
        <div className={`${styles.desktopOnly} ${styles.siteTable} border border-2 rounded-4 p-3`}>
        <table className="table align-middle mb-0">
          <thead className="table-light">
            <tr>
              <th>Site Name</th>
              <th>Latitude</th>
              <th>Longitude</th>
              <th>Edit</th>
              <th>Delete</th>
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
                    data-bs-toggle="modal"
                    data-bs-target="#createSite"
                    onClick={() => handleOpenEdit(s)}
                    aria-label={`Edit ${s.siteName || "site"}`}
                  >
                    <HiPencilSquare />
                  </button>
                </td>

                <td>
                  <button
                    type="button"
                    className="btn btn-link text-danger p-0 border-0"
                    onClick={() => handleDeleteSite(s.id)}
                    aria-label={`Delete ${s.siteName || "site"}`}
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
  </>
);

}

export default Site;
