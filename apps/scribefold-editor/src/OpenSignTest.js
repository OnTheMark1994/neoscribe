import React from "react"; 
import Window from "./Features/Util/Window";
import Opensign from "@opensign/react";

export default function OpenSignTest(){

    return(
        <Window
            title="test"
            onClose={()=>{}}
            open={true}
        >
                Opensign test
            <Opensign
                onLoad={() => console.log("success")}
                onLoadError={(error) => console.log(error)}
                // templateId="#templateId"
                baseUrl="https://app.opensignlabs.com/api/app"
                appId="opensign"
            />
            <iframe src={"https://app.opensignlabs.com/api/app"}></iframe>
        </Window>
    )
}