import React from "react";
import cd_1 from "./assets/cd_1.png";
import cd_2 from "./assets/cd_2.png";
import cd_3 from "./assets/cd_3.png";
import cd_4 from "./assets/cd_4.png";

const MoreFeatures = () => {
  return (
    <div className="overflow-x-hidden">
      <div className="flex min-h-screen w-screen justify-center  gradient-bg2 py-10">
        <div className=" flex flex-col justify-center items-center w-full h-full  gap-36  ">
          <div className="flex  w-full justify-center  rounded-lg  gap-10 px-28 ">
            <div className="w-1/2 h-[600px] card glass rounded-lg border-[10px] border-[#6a51e9] flex flex-col justify-start items-center px-5 py-5 ">
              <img src={cd_1} alt="" />
              <h1 className="text-white poppins-bold  text-[36px] ">
                Dynamic Video Chats
              </h1>
              <p className="text-[#e1b8f1] poppins-thin  text-[20px] text-wrap text-center px-5 ">
                Dive into real-time, personal video conversations that redefine
                human connections. Monkey's lightning-fast and spontaneous video
                interactions create exhilarating encounters, making every
                conversation feel fresh and authentic.
              </p>
            </div>
            <div className="w-1/2 h-[600px] card glass rounded-lg border-[10px] border-[#6a51e9] flex flex-col justify-start items-center px-5 py-5 ">
              <img src={cd_2} alt="" />
              <h1 className="text-white poppins-bold  text-[36px] ">
                Global Reach
              </h1>
              <p className="text-[#e1b8f1] poppins-thin  text-[20px] text-wrap text-center px-5 ">
                Break through geographical barriers and engage with a diverse
                global community. Monkey's platform fosters cross-cultural
                interactions that broaden perspectives and spark meaningful
                exchanges with people worldwide.
              </p>
            </div>
          </div>
          <div className="flex  w-full justify-center rounded-lg  gap-10 px-28 ">
            <div className="w-1/2 h-[600px] card glass rounded-lg border-[10px] border-[#6a51e9] flex flex-col justify-start items-center px-5 py-5 ">
              <img src={cd_3} alt="" />
              <h1 className="text-white poppins-bold  text-[36px] ">
                Simplicity and Security
              </h1>
              <p className="text-[#e1b8f1] poppins-thin  text-[20px] text-wrap text-center px-5 ">
                Experience Monkey's intuitive interface, enabling seamless video
                chats. Our platform prioritizes stringent security, ensuring
                user safety and privacy
              </p>
            </div>
            <div className="w-1/2 h-[600px] card glass border-[10px] border-[#6a51e9] flex flex-col justify-start items-center px-5  py-5">
              <img src={cd_4} alt="" />
              <h1 className="text-white poppins-bold  text-[36px] ">
                Random Matching
              </h1>
              <p className="text-[#e1b8f1] poppins-thin  text-[20px] text-wrap text-center px-5 ">
                Explore Monkey's random matching feature for unexpected
                encounters. Discover new connections and engage in genuine
                conversations that go beyond the ordinary, enhancing your social
                experience online.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MoreFeatures;
