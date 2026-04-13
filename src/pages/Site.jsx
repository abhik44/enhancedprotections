import Search from "../ui/Search";
import { useEffect, useMemo, useState } from "react";
import CreateSiteModal from "./CreateSiteModal";
import { db } from "../firebase";
import { collection, onSnapshot } from "firebase/firestore";
import Spinner from "../ui/Spinner";
import { HiPencilSquare } from "react-icons/hi2";


function Site() {

  const [sites , setSites] = useState([]);
  const [loading , setLoading] = useState(true);

  // search state
  const [searchTerm , setSearchTerm] = useState("");

  // Editing state
  const [editingSite , setEditingSite] = useState(null);


  useEffect(() => {
    setLoading(true);
   const coll = collection (db , "sites");

   const unsub = onSnapshot (
    coll ,
    (snapshot) => {
      const items = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setSites(items);
      setLoading(false);
    },
    (err) => {
      console.error("Failed to fetch sites" , err);
      setSites([]);
      setLoading(false);
    }
   );
   return ()  => unsub();

  } , []);

  // Filter by sitename

  const filteredSites = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if(!q) return sites;
    
    return sites.filter ((s) => 
    (s.siteName || "").toLowerCase().includes(q)
    );
  } , [searchTerm , sites]);
  

  // when clicking create site
const handleOpenCreate = () => {
  setEditingSite(null);
};
 
const handleOpenEdit = (site) => {
    setEditingSite(site);
};



  return (
    <>
      <div className="d-flex justify-content-between gap-5 align">
        <h3 className="text-4a">Sites</h3>

        <div className="d-flex justify-content-end gap-4">

          {/* Search bar */}
          <div style={{ width: "500px" }}>
            <Search 
            value={searchTerm}
            onChange = {(e) => setSearchTerm(e.target.value)}
            placeholder="Search site name.."
             />
           
          </div>

          {/* Button for Create Site Modal */}
          <div>
            <button
              type="button"
              className="btn custom-red-bg text-white fw-medium"
              data-bs-toggle="modal"
              data-bs-target="#createSite"
              onClick={handleOpenCreate}
            >
              + Create Site
            </button>

            <CreateSiteModal editingSite={editingSite} onClose={() => setEditingSite(null)} />
          </div>
        </div>
      </div>

      {/* Sites table */}
      <div className="siteTable border border-2 rounded-4 p-3">
        {loading ? (
          <div className="text-custom-red text-center d-flex align-items-center justify-content-center gap-2">
            <Spinner colorSpinner="text-custom-red" />
            <span>Loading sites...</span>
          </div>
        ) : filteredSites.length === 0 ? (
          <div className="alert text-custom-red fw-bold text-center  mb-0">No Sites Found :(</div>
        ) : (
          <table className="table">
            <thead className="table-light">
              <tr>
                <th>Site Name</th>
                <th>Latitude</th>
                <th>Longitude</th>
                <th >Edit</th>
              </tr>
            </thead>

            <tbody>
              {filteredSites.map((s) => (
                <tr key={s.id}>
                  <td>{s.siteName ?? "-"}</td>
                  <td>{s.latitude ?? "-"}</td>
                  <td>{s.longitude ?? "-"}</td>
                  <td className="ps-3">
                    <button type="button" className="btn btn-link text-black p-0 border-0" data-bs-toggle="modal" data-bs-target="#createSite" 
                    onClick={() => handleOpenEdit(s)}
                    >
                    
                    <HiPencilSquare/>
                    </button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

export default Site;
