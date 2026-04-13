
import { HiSearch } from "react-icons/hi";
import styles from "./Search.module.css";

function Search({ value, onChange, placeholder = "Search" }) {
  return (
    <div
      className={`border border-2 rounded-pill d-flex align-items-center px-2 ${styles.search}`}
    >
      <HiSearch className={styles.searchIcon} />
      <input
        type="search"
        className="form-control border-0"
        placeholder={placeholder}
        aria-label="Search"
        value={value ?? ""}              
        onChange={onChange || (() => {})} 
      />
    </div>
  );
}

export default Search;
