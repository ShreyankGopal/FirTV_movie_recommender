import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import sapflixLogo from '../../images/sapflix.png';

function NavbarWithoutUser() {
  const [show, handleShow] = useState(false);
  const transitionNavBar = () => {
    if (window.scrollY > 100) {
      handleShow(true);
    } else {
      handleShow(false);
    }
  };

  useEffect(() => {
    window.addEventListener("scroll", transitionNavBar);
    return () => {
      window.removeEventListener("scroll", transitionNavBar);
    };
  }, []);

  return (
    <div>
      <header
        className={`fixed z-50 w-full flex items-center py-4 transition duration-500 ease-in-out ${
          show && "bg-black transition duration-500 ease-in-out"
        }`}
      >
        <div className="w-9/12 md:w-11/12">
          <img
            className="h-8 sm:h-12 sm:w-18 ml-8 cursor-pointer"
            src={sapflixLogo}
            alt="SAPFLIX"
          />
        </div>

        <div>
          <Link to="/signin">
            <button className="bg-red-600 px-8 rounded-sm py-2 text-white text-base font-bold mr-4 lg:mr-0">
              Login
            </button>
          </Link>
        </div>
      </header>
    </div>
  );
}

export default NavbarWithoutUser;
