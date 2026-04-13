
import { useEffect, useRef, useState } from "react";
import styles from "./CreateSiteModal.module.css";
import { db } from "../firebase";
import { collection, addDoc, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import toast from "react-hot-toast";
import {
  MapContainer,
  TileLayer,
  Marker,
  useMapEvents,
  useMap,
} from "react-leaflet";
import L from "leaflet";


delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});


function LocationPicker({ setPosition }) {
  useMapEvents({
    click(e) {
      setPosition({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}


function RecenterMap({ position, zoom = 15 }) {
  const map = useMap();
  useEffect(() => {
    if (!position) return;
    try {
      map.setView([position.lat, position.lng], zoom);
    } catch (err) {
      // ignore
    }
  }, [position, zoom, map]);
  return null;
}


function getPlaceDetailsById(placeId) {
  return new Promise((resolve, reject) => {
    if (!window.google || !window.google.maps || !window.google.maps.places) {
      return reject(new Error("Google Maps Places library not available"));
    }
    const container = document.createElement("div");
    const service = new window.google.maps.places.PlacesService(container);
    service.getDetails({ placeId, fields: ["geometry", "formatted_address", "name"] }, (place, status) => {
      if (status === window.google.maps.places.PlacesServiceStatus.OK && place) {
        resolve(place);
      } else {
        reject(new Error("PlacesService.getDetails failed: " + status));
      }
    });
  });
}

/* --- Main component --- */
export default function CreateSiteModal({ editingSite, onClose }) {
  const modalId = "createSite";
  const modalRef = useRef(null);
  const autoContainerRef = useRef(null);
  const isEdit = Boolean(editingSite);

  const [form, setForm] = useState({
    siteName: "",
    address: "",
    latitude: "",
    longitude: "",
  });

  const [pos, setPos] = useState(null);
  const [saving, setSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const placeWidgetRef = useRef(null);
  const widgetCleanupRef = useRef(null);
  const classicAutocompleteRef = useRef(null);
  const createdInputRef = useRef(null);
  const placeListenerRef = useRef(null);


  useEffect(() => {
    const el = document.getElementById(modalId);
    if (!el) return;

    modalRef.current = el;

    const shown = () => setIsModalOpen(true);
    const hidden = () => {
      setIsModalOpen(false);
      resetForm();
      onClose?.();
    };

    el.addEventListener("shown.bs.modal", shown);
    el.addEventListener("hidden.bs.modal", hidden);

    return () => {
      el.removeEventListener("shown.bs.modal", shown);
      el.removeEventListener("hidden.bs.modal", hidden);
    };
  }, [modalId, onClose]);


  useEffect(() => {
    if (editingSite) {
      const lat = editingSite.latitude;
      const lng = editingSite.longitude;

      setForm({
        siteName: editingSite.siteName || "",
        address: editingSite.address || "",
        latitude: lat ? String(lat) : "",
        longitude: lng ? String(lng) : "",
      });

      if (!isNaN(Number(lat)) && !isNaN(Number(lng))) {
        setPos({ lat: Number(lat), lng: Number(lng) });
      } else {
        setPos(null);
      }
    } else {
      resetForm();
    }
  }, [editingSite]);

  
  useEffect(() => {
    if (pos) {
      setForm((s) => ({
        ...s,
        latitude: String(pos.lat),
        longitude: String(pos.lng),
      }));
    }
  }, [pos]);

 
  useEffect(() => {
    if (!isModalOpen) return;
    if (!autoContainerRef.current) return;

    // cleanup previous
    if (widgetCleanupRef.current) {
      try {
        widgetCleanupRef.current();
      } catch {}
      widgetCleanupRef.current = null;
    }
    if (placeWidgetRef.current) {
      try {
        if (typeof placeWidgetRef.current.remove === "function") placeWidgetRef.current.remove();
      } catch {}
      placeWidgetRef.current = null;
    }

    (async () => {
      try {
        if (window.google?.maps?.importLibrary) {
          const { PlaceAutocompleteElement } = await window.google.maps.importLibrary("places");

          const widget = new PlaceAutocompleteElement({
            componentRestrictions: { country: "au" },
          });

          autoContainerRef.current.innerHTML = "";
          autoContainerRef.current.appendChild(widget);
          placeWidgetRef.current = widget;

          // handler
          const onGmpSelect = async (ev) => {
            try {
              const placePrediction = ev?.placePrediction || ev?.place || null;

          
              let placeObj = null;
              if (placePrediction && typeof placePrediction.toPlace === "function") {
                try {
                  placeObj = placePrediction.toPlace();
                  if (placeObj && typeof placeObj.fetchFields === "function") {
                    try {
                      await placeObj.fetchFields({ fields: ["location", "formattedAddress", "displayName"] });
                    } catch {}
                  }
                } catch {}
              }

              let lat = null;
              let lng = null;
              let formatted = "";

              if (placeObj?.location && typeof placeObj.location.lat === "number" && typeof placeObj.location.lng === "number") {
                lat = placeObj.location.lat;
                lng = placeObj.location.lng;
                formatted = placeObj.formattedAddress || placeObj.displayName || "";
              }

              // older shape
              if ((lat == null || lng == null) && placeObj?.geometry) {
                try {
                  const loc = placeObj.geometry.location;
                  if (loc) {
                    if (typeof loc.lat === "function") {
                      lat = loc.lat();
                      lng = loc.lng();
                    } else if (typeof loc.lat === "number") {
                      lat = loc.lat;
                      lng = loc.lng;
                    } else if (loc.toJSON) {
                      const j = loc.toJSON();
                      if (j && typeof j.lat === "number") {
                        lat = j.lat;
                        lng = j.lng;
                      }
                    }
                  }
                  formatted = formatted || placeObj.formattedAddress || placeObj.displayName || placeObj.name || "";
                } catch {}
              }

              if ((lat == null || lng == null) && placePrediction?.placeId) {
                try {
                  const details = await getPlaceDetailsById(placePrediction.placeId);
                  if (details?.geometry?.location) {
                    const loc = details.geometry.location;
                    if (typeof loc.lat === "function") {
                      lat = loc.lat();
                      lng = loc.lng();
                    } else if (typeof loc.lat === "number") {
                      lat = loc.lat;
                      lng = loc.lng;
                    } else if (loc.toJSON) {
                      const j = loc.toJSON();
                      if (j && typeof j.lat === "number") {
                        lat = j.lat;
                        lng = j.lng;
                      }
                    }
                  }
                  formatted = formatted || details.formatted_address || details.name || "";
                } catch {}
              }

              // final fallback: check placePrediction for location fields
              if ((lat == null || lng == null) && placePrediction) {
                if (typeof placePrediction.lat === "number" && typeof placePrediction.lng === "number") {
                  lat = placePrediction.lat;
                  lng = placePrediction.lng;
                } else if (placePrediction.location && typeof placePrediction.location.lat === "number") {
                  lat = placePrediction.location.lat;
                  lng = placePrediction.location.lng;
                }
              }

              if (lat == null || lng == null) {
                toast.error("Unable to get location for selected address.");
                return;
              }

              setForm((s) => ({
                ...s,
                address: formatted || s.address || "",
                latitude: String(lat),
                longitude: String(lng),
              }));
              setPos({ lat, lng });
            } catch {
              toast.error("Unable to get location for selected address.");
            }
          };

          // attach listener
          if (typeof widget.addEventListener === "function") {
            widget.addEventListener("gmp-select", onGmpSelect);
            widgetCleanupRef.current = () => {
              try { widget.removeEventListener && widget.removeEventListener("gmp-select", onGmpSelect); } catch {}
              try { widget.remove && widget.remove(); } catch {}
            };
          } else if (typeof widget.addListener === "function") {
            const l = widget.addListener("gmp-select", onGmpSelect);
            widgetCleanupRef.current = () => {
              try { l.remove && l.remove(); } catch {}
              try { widget.remove && widget.remove(); } catch {}
            };
          } else {
            widgetCleanupRef.current = () => {
              try { widget.remove && widget.remove(); } catch {}
            };
          }

          return;
        }

      
        if (window.google && window.google.maps && window.google.maps.places) {
          autoContainerRef.current.innerHTML = "";
          const input = document.createElement("input");
          input.type = "text";
          input.className = "form-control " + (styles.inputBox || "");
          input.placeholder = "Search address";
          input.style.background = "white";
          autoContainerRef.current.appendChild(input);
          createdInputRef.current = input;

          const autocomplete = new window.google.maps.places.Autocomplete(input, {
            componentRestrictions: { country: "au" },
          });
          classicAutocompleteRef.current = autocomplete;

          const listener = autocomplete.addListener("place_changed", () => {
            try {
              const place = autocomplete.getPlace();
              if (!place) {
                toast.error("Unable to get location for selected address.");
                return;
              }

              let lat = null;
              let lng = null;
              let formatted = "";

              if (place.geometry) {
                if (place.geometry.location && typeof place.geometry.location.lat === "function") {
                  lat = place.geometry.location.lat();
                  lng = place.geometry.location.lng();
                } else if (place.geometry.location && typeof place.geometry.location.toJSON === "function") {
                  const json = place.geometry.location.toJSON();
                  lat = json.lat;
                  lng = json.lng;
                }
                formatted = place.formatted_address || place.name || input.value || "";
              }

              if (lat == null || lng == null) {
                toast.error("Unable to get location for selected address.");
                return;
              }

              setForm((s) => ({
                ...s,
                address: formatted,
                latitude: String(lat),
                longitude: String(lng),
              }));
              setPos({ lat, lng });
            } catch {
              toast.error("Unable to get location for selected address.");
            }
          });

          placeListenerRef.current = listener;
          widgetCleanupRef.current = () => {
            try { listener.remove(); } catch {}
            try { if (createdInputRef.current) createdInputRef.current.remove(); } catch {}
          };

          return;
        }

        // If no Google at all, just leave container empty
        autoContainerRef.current.innerHTML = "";
      } catch {
        toast.error("Autocomplete initialization failed.");
      }
    })();

    return () => {
      try {
        if (widgetCleanupRef.current) widgetCleanupRef.current();
      } catch {}
      widgetCleanupRef.current = null;

      try {
        if (placeWidgetRef.current && typeof placeWidgetRef.current.remove === "function") placeWidgetRef.current.remove();
      } catch {}
      placeWidgetRef.current = null;

      try {
        if (placeListenerRef.current && placeListenerRef.current.remove) placeListenerRef.current.remove();
      } catch {}
      placeListenerRef.current = null;

      try {
        if (createdInputRef.current && createdInputRef.current.remove) createdInputRef.current.remove();
      } catch {}
      createdInputRef.current = null;
    };
  }, [isModalOpen]);

  /* --- form change handler --- */
  const handleChange = (e) => {
    const { id, value } = e.target;
    setForm((s) => ({ ...s, [id]: value }));

    if (id === "latitude") {
      const lat = Number(value);
      const lng = Number(form.longitude);
      if (!isNaN(lat) && !isNaN(lng)) setPos({ lat, lng });
    }

    if (id === "longitude") {
      const lat = Number(form.latitude);
      const lng = Number(value);
      if (!isNaN(lat) && !isNaN(lng)) setPos({ lat, lng });
    }
  };


  const validate = () => {
    if (!form.siteName.trim()) return "Please enter a site name.";
    if (!form.latitude || !form.longitude) return "Select a location or address.";
    if (isNaN(Number(form.latitude)) || isNaN(Number(form.longitude)))
      return "Latitude & Longitude must be numbers.";
    return null;
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
      document.body.classList.remove("modal-open");
      return;
    }
    let inst = bs.Modal.getInstance(el);
    if (!inst) inst = new bs.Modal(el);
    inst.hide();
  };

  const resetForm = () => {
    setForm({
      siteName: "",
      address: "",
      latitude: "",
      longitude: "",
    });
    setPos(null);
    setSaving(false);
  };

  const handleClose = () => {
    resetForm();
    onClose?.();
  };

  /* --- save / update --- */
  const handleSave = async () => {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }

    setSaving(true);

    try {
      const payload = {
        siteName: form.siteName,
        address: form.address,
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
      };

      if (isEdit && editingSite?.id) {
        const ref = doc(db, "sites", editingSite.id);
        await updateDoc(ref, { ...payload, updatedAt: serverTimestamp() });
        toast.success("Site updated successfully");
      } else {
        await addDoc(collection(db, "sites"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        toast.success("Site created successfully");
      }
    } catch (e) {
      toast.error("Failed to save site: " + (e?.message || e));
      setSaving(false);
      return;
    }

    try {
      hideBootstrapModal();
      handleClose();
    } catch (hideErr) {
     
      try {
        document.querySelectorAll(".modal-backdrop").forEach((n) => n.remove());
        document.body.classList.remove("modal-open");
      } catch {}
    } finally {
      setSaving(false);
    }
  };

  /* --- default center (Australia) --- */
  const defaultCenter = pos ?? { lat: -25.2744, lng: 133.7751 };

  return (
    <div
      className="modal fade"
      id={modalId}
      tabIndex="-1"
      aria-hidden="true"
      data-bs-backdrop="static"
    >
      <div className="modal-dialog modal-xl modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header px-4">
            <h5>{isEdit ? "Edit Site" : "Create Site"}</h5>
            <button
              type="button"
              className="btn-close"
              data-bs-dismiss="modal"
              onClick={() => {
                resetForm();
                onClose?.();
              }}
            />
          </div>

          <div className="modal-body px-4">
            <form onSubmit={(e) => e.preventDefault()}>
              <div className="row">
                <div className="col-md-4 mb-3">
                  <label className="form-label fw-medium">Site name</label>
                  <input
                    id="siteName"
                    className={`form-control ${styles.inputBox}`}
                    value={form.siteName}
                    onChange={handleChange}
                    placeholder="Enter site name"
                  />
                </div>

                <div className="col-md-8 mb-3">
                  <label className="form-label fw-medium">Select address</label>
                  <div
                    ref={autoContainerRef}
                    className={`form-control ${styles.inputBox}`}
                    style={{ padding: 0, overflow: "visible" }}
                  />
                </div>

                <div className="col-md-4 mb-3">
                  <label className="form-label fw-medium">Latitude</label>
                  <input
                    id="latitude"
                    className={`form-control ${styles.inputBox}`}
                    value={form.latitude}
                    onChange={handleChange}
                  />
                </div>

                <div className="col-md-4 mb-3">
                  <label className="form-label fw-medium">Longitude</label>
                  <input
                    id="longitude"
                    className={`form-control ${styles.inputBox}`}
                    value={form.longitude}
                    onChange={handleChange}
                  />
                </div>

                <div className="col-12 mb-3">
                  <label className="form-label fw-medium">Select location on map</label>
                  <div className={styles.mapWrapper} style={{ minHeight: 300 }}>
                    {isModalOpen && (
                      <MapContainer
                        center={[defaultCenter.lat, defaultCenter.lng]}
                        zoom={5}
                        className="leaflet-container"
                        style={{ height: "100%", width: "100%" }}
                      >
                        <TileLayer
                          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                          attribution="© OpenStreetMap contributors"
                        />
                        <LocationPicker setPosition={setPos} />

                        {pos && (
                          <>
                            <RecenterMap position={pos} zoom={15} />
                            <Marker
                              position={[pos.lat, pos.lng]}
                              draggable={true}
                              eventHandlers={{
                                dragend: (e) => {
                                  const latlng = e.target.getLatLng();
                                  setPos({ lat: latlng.lat, lng: latlng.lng });
                                  setForm((s) => ({ ...s, address: "" }));
                                },
                              }}
                            />
                          </>
                        )}
                      </MapContainer>
                    )}
                  </div>
                </div>
              </div>
            </form>
          </div>

          <div className="modal-footer px-4 pb-4 border-0">
            <button className="btn btn-secondary" data-bs-dismiss="modal" onClick={resetForm}>
              Close
            </button>
            <button className="btn btn-danger text-white" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : isEdit ? "Update" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
