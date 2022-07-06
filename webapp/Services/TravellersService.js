export function GetTravel(UserId, Date){
    if(Date=='2022-07-04'){
        return {
            "Date" : "2022-07-04",
            "Edges" : [
                { 
                    "StartAddress" : "Hillerød",
                    "DistinationAddress" : "Virum",
                    "Distance" : 21.3
                },
                { 
                    "StartAddress" : "Virum",
                    "DistinationAddress" : "Hillerød",
                    "Distance" : 21.3
                }
            ]
        }
    }

    return {
        "Date" : "2022-07-02",
        "Edges" : [
            { 
                "StartAddress" : "Roskilde",
                "DistinationAddress" : "Virum",
                "Distance" : 21.3
            },
            { 
                "StartAddress" : "Virum",
                "DistinationAddress" : "Andel Pionergården",
                "Distance" : 21.3
            },
            { 
                "StartAddress" : "Andel Pionergården",
                "DistinationAddress" : "Roskilde",
                "Distance" : 21.3
            }
        ]
    }
}
