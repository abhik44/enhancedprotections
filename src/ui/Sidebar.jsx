import InnerNav from './InnerNav'

import styles from './Sidebar.module.css'

function Sidebar() {
    return (
        <div className={styles.sidebar}>

            <div className='text-center' > 
     <img src="/logo.png" alt="" className={styles.sidebarlogo} />
            </div>
            
            <div className={styles.innerNavDiv}>

                <InnerNav/>
            </div>
        </div>
    )
}

export default Sidebar
