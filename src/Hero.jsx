import React from "react";
import loginVideo from "./assets/login.mp4";

<video src={loginVideo} autoPlay loop muted />;

const Hero = () => {
  return (
    <div className="overflow-x-hidden">
      <div className="flex min-h-screen w-screen gradient-bg py-10">
        <div className="w-1/3   flex flex-col justify-start items-start px-5">
          <h1 className="text-gray-50 font-thin text-[50px]">Socio</h1>
          <p className="text-gray-50 poppins-bold  text-[40px] text-wrap pl-20 pt-5 ">
            MAKE NEW FRIENDS FACE-TO-FACE
          </p>
          <button className="text-black poppins-blod text-[20px] px-20 py-3 bg-white rounded-lg ml-20 mt-5">
            Video call
          </button>
          <button className="text-gray-50 poppins-blod text-[20px] px-20 py-3 bg-violet-500 rounded-lg ml-20 mt-5">
            features
          </button>
        </div>

        <div className="w-2/3  flex justify-center items-center px-[68px] py-[82px]">
          <div className="h-full w-full border-[15px] border-[#6a51e9] rounded-lg  ">
            <video
              className=" w-full h-full object-cover"
              src={loginVideo}
              autoPlay
              loop
              muted
            ></video>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Hero;
