import json
import math
import os

def haversine(lon1, lat1, lon2, lat2):
    R = 6371000  # meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = math.sin(delta_phi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(delta_lambda/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

# Define real master stops: key -> (name, [lng, lat], zone)
MASTER_STOPS = {
    # 20 Key Terminal Hubs (preserved exact IDs S0001 to S0020)
    "S0001": ("Majestic (Kempegowda Bus Station)", [77.5726, 12.9771], "central"),
    "S0002": ("Silk Board Junction", [77.6228, 12.9172], "southeast"),
    "S0003": ("ITPL Bus Stop", [77.7298, 12.9863], "east"),
    "S0004": ("Electronic City Bus Station", [77.6602, 12.8452], "southeast"),
    "S0005": ("Whitefield Bus Station", [77.7495, 12.9698], "east"),
    "S0006": ("Koramangala Bus Station", [77.6231, 12.9352], "southeast"),
    "S0007": ("Yelahanka Bus Station", [77.5962, 13.1002], "north"),
    "S0008": ("Hebbal Flyover", [77.5972, 13.0352], "north"),
    "S0009": ("Jayanagar 4th Block", [77.5830, 12.9302], "south"),
    "S0010": ("KR Puram Bus Station", [77.6960, 13.0072], "east"),
    "S0011": ("Marathahalli Bridge", [77.7011, 12.9563], "east"),
    "S0012": ("Banashankari Bus Station", [77.5730, 12.9152], "south"),
    "S0013": ("HSR Layout Bus Stop", [77.6435, 12.9118], "southeast"),
    "S0014": ("Peenya Industry", [77.5252, 13.0322], "northwest"),
    "S0015": ("Indiranagar Bus Stop", [77.6412, 12.9784], "east"),
    "S0016": ("Vijayanagar Bus Stop", [77.5342, 12.9642], "west"),
    "S0017": ("Rajajinagar Bus Stop", [77.5532, 12.9902], "west"),
    "S0018": ("BTM Layout Bus Stop", [77.6101, 12.9165], "south"),
    "S0019": ("Basavanagudi Bus Stop", [77.5732, 12.9421], "south"),
    "S0020": ("Yeshwantpur Bus Station", [77.5502, 13.0282], "northwest"),

    # Central & East / Old Airport Road / Whitefield Corridor
    "S0021": ("Corporation Circle", [77.5898, 12.9698], "central"),
    "S0022": ("Richmond Circle", [77.5968, 12.9676], "central"),
    "S0023": ("Mayo Hall", [77.6083, 12.9741], "central"),
    "S0024": ("Vellara Junction", [77.6045, 12.9652], "central"),
    "S0025": ("Shanthi Nagar Bus Station", [77.5942, 12.9545], "central"),
    "S0026": ("Austin Town", [77.6162, 12.9610], "central"),
    "S0027": ("Neelasandra", [77.6185, 12.9555], "central"),
    "S0028": ("Trinity Circle", [77.6186, 12.9729], "central"),
    "S0029": ("Ulsoor", [77.6253, 12.9778], "central"),
    "S0030": ("Command Hospital", [77.6325, 12.9625], "east"),
    "S0031": ("Domlur Flyover", [77.6385, 12.9609], "east"),
    "S0032": ("Manipal Hospital", [77.6534, 12.9592], "east"),
    "S0033": ("Murugeshpalya", [77.6598, 12.9585], "east"),
    "S0034": ("HAL Main Gate", [77.6685, 12.9576], "east"),
    "S0035": ("HAL Helicopter Division", [77.6835, 12.9568], "east"),
    "S0036": ("Marathahalli Multiplex", [77.6975, 12.9564], "east"),
    "S0037": ("Kundalahalli Gate", [77.7128, 12.9612], "east"),
    "S0038": ("AECS Layout", [77.7164, 12.9642], "east"),
    "S0039": ("Brookefield", [77.7185, 12.9675], "east"),  # True location in East Bengaluru!
    "S0040": ("BEML Layout", [77.7215, 12.9720], "east"),
    "S0041": ("Graphite India", [77.7241, 12.9785], "east"),
    "S0042": ("KTPO Whitefield", [77.7275, 12.9835], "east"),
    "S0043": ("Pattandur Agrahara", [77.7385, 12.9855], "east"),
    "S0044": ("Hope Farm Junction", [77.7478, 12.9842], "east"),
    "S0045": ("Whitefield Post Office", [77.7510, 12.9750], "east"),

    # Outer Ring Road (ORR: Hebbal -> Silk Board)
    "S0046": ("Manyata Tech Park", [77.6195, 13.0450], "north"),
    "S0047": ("Nagawara Junction", [77.6235, 13.0395], "north"),
    "S0048": ("Hennur Cross", [77.6360, 13.0315], "northeast"),
    "S0049": ("Kalyan Nagar", [77.6432, 13.0245], "northeast"),
    "S0050": ("Babusapalya", [77.6535, 13.0210], "northeast"),
    "S0051": ("Ramamurthy Nagar", [77.6710, 13.0182], "northeast"),
    "S0052": ("Kasturi Nagar", [77.6785, 13.0125], "northeast"),
    "S0053": ("Tin Factory", [77.6855, 13.0055], "east"),
    "S0054": ("KR Puram Railway Station", [77.6920, 13.0035], "east"),
    "S0055": ("Mahadevapura", [77.6980, 12.9915], "east"),
    "S0056": ("Doddanekundi", [77.7015, 12.9765], "east"),
    "S0057": ("Kartik Nagar", [77.7008, 12.9675], "east"),
    "S0058": ("Bellandur", [77.6765, 12.9285], "southeast"),
    "S0059": ("Devarabisanahalli", [77.6845, 12.9332], "southeast"),
    "S0060": ("Kadubeesanahalli", [77.6922, 12.9378], "southeast"),
    "S0061": ("Ecospace", [77.6810, 12.9310], "southeast"),
    "S0062": ("Iblur Junction", [77.6710, 12.9268], "southeast"),
    "S0063": ("Agara Junction", [77.6358, 12.9248], "southeast"),
    "S0064": ("Jakkasandra", [77.6315, 12.9220], "southeast"),

    # Hosur Road / Electronic City Corridor
    "S0065": ("Madiwala", [77.6205, 12.9225], "southeast"),
    "S0066": ("Bommanahalli", [77.6275, 12.9052], "southeast"),
    "S0067": ("Garebhavipalya", [77.6335, 12.8965], "southeast"),
    "S0068": ("Kudlu Gate", [77.6395, 12.8895], "southeast"),
    "S0069": ("Singasandra", [77.6482, 12.8790], "southeast"),
    "S0070": ("Hosa Road", [77.6535, 12.8685], "southeast"),
    "S0071": ("Electronic City Tollgate", [77.6580, 12.8550], "southeast"),
    "S0072": ("Wipro Gate Electronic City", [77.6625, 12.8485], "southeast"),
    "S0073": ("Infosys Gate Electronic City", [77.6655, 12.8420], "southeast"),

    # South / Jayanagar / Banashankari Corridor
    "S0074": ("Town Hall", [77.5855, 12.9635], "central"),
    "S0075": ("KR Market", [77.5775, 12.9615], "central"),
    "S0076": ("Lalbagh West Gate", [77.5855, 12.9505], "south"),
    "S0077": ("Minerva Circle", [77.5815, 12.9555], "south"),
    "S0078": ("National College Basavanagudi", [77.5755, 12.9465], "south"),
    "S0079": ("Gandhi Bazaar", [77.5732, 12.9421], "south"),
    "S0080": ("Ashoka Pillar", [77.5880, 12.9410], "south"),
    "S0081": ("Madhavan Park", [77.5875, 12.9355], "south"),
    "S0082": ("South End Circle", [77.5802, 12.9360], "south"),
    "S0083": ("Jayanagar 3rd Block", [77.5825, 12.9330], "south"),
    "S0084": ("Jayanagar 9th Block", [77.5950, 12.9220], "south"),
    "S0085": ("Sangam Circle", [77.5750, 12.9230], "south"),
    "S0086": ("Banashankari TTMC", [77.5730, 12.9152], "south"),
    "S0087": ("Sarakki Gate", [77.5775, 12.9095], "south"),
    "S0088": ("JP Nagar 6th Phase", [77.5850, 12.9065], "south"),
    "S0089": ("Jayadeva Hospital", [77.5995, 12.9180], "south"),
    "S0090": ("Udupi Garden BTM", [77.6080, 12.9165], "south"),
    "S0091": ("Dairy Circle", [77.6015, 12.9372], "south"),
    "S0092": ("Lakkasandra", [77.5990, 12.9435], "south"),
    "S0093": ("Wilson Garden", [77.5965, 12.9490], "south"),
    "S0094": ("Adugodi", [77.6095, 12.9410], "southeast"),
    "S0095": ("St. John's Hospital", [77.6190, 12.9315], "southeast"),
    "S0096": ("Koramangala Sony World", [77.6255, 12.9348], "southeast"),
    "S0097": ("Koramangala 1st Block", [77.6320, 12.9295], "southeast"),
    "S0098": ("HSR Layout Sector 1", [77.6515, 12.9145], "southeast"),
    "S0099": ("HSR Layout Sector 2", [77.6480, 12.9095], "southeast"),

    # West / North-West (Rajajinagar, Vijayanagar, Peenya, Yeshwantpur)
    "S0100": ("Okalipuram", [77.5645, 12.9810], "west"),
    "S0101": ("Prasanna Theatre", [77.5540, 12.9775], "west"),
    "S0102": ("Magadi Road Tollgate", [77.5450, 12.9730], "west"),
    "S0103": ("Magadi Road Metro", [77.5410, 12.9690], "west"),
    "S0104": ("Attiguppe", [77.5285, 12.9595], "west"),
    "S0105": ("Deepanjali Nagar", [77.5295, 12.9515], "west"),
    "S0106": ("Mysore Road Satellite Bus Station", [77.5385, 12.9495], "west"),
    "S0107": ("Nayandahalli", [77.5230, 12.9440], "west"),
    "S0108": ("Kathriguppe", [77.5510, 12.9285], "southwest"),
    "S0109": ("Chennammana Kere", [77.5595, 12.9230], "southwest"),
    "S0110": ("Chandra Layout", [77.5210, 12.9610], "west"),
    "S0111": ("Navrang Circle", [77.5540, 12.9960], "west"),
    "S0112": ("Rajajinagar 1st Block", [77.5565, 13.0030], "west"),
    "S0113": ("Swastik Circle", [77.5685, 12.9890], "central"),
    "S0114": ("Malleshwaram 8th Cross", [77.5712, 12.9982], "northwest"),
    "S0115": ("Malleshwaram Circle", [77.5705, 13.0050], "northwest"),
    "S0116": ("Yeshwantpur TTMC", [77.5502, 13.0282], "northwest"),
    "S0117": ("Goraguntepalya", [77.5365, 13.0298], "northwest"),
    "S0118": ("SRS Road Peenya", [77.5310, 13.0310], "northwest"),
    "S0119": ("Jalahalli Cross", [77.5215, 13.0385], "northwest"),

    # North / Yelahanka / Bellary Road
    "S0120": ("Palace Guttahalli", [77.5795, 12.9960], "north"),
    "S0121": ("Mekhri Circle", [77.5855, 13.0085], "north"),
    "S0122": ("Veterinary College", [77.5885, 13.0175], "north"),
    "S0123": ("Ganganagar", [77.5910, 13.0235], "north"),
    "S0124": ("CBI Office Bellary Road", [77.5935, 13.0285], "north"),
    "S0125": ("Kodigehalli Gate", [77.5965, 13.0535], "north"),
    "S0126": ("Byatarayanapura", [77.5960, 13.0645], "north"),
    "S0127": ("Jakkur Aerodrome", [77.5965, 13.0760], "north"),
    "S0128": ("Allalasandra", [77.5960, 13.0875], "north"),
    "S0129": ("Yelahanka NES", [77.5962, 13.0955], "north"),
    "S0130": ("Kogilu Cross", [77.6080, 13.1030], "north"),

    # East Metro / Old Madras Road / Indiranagar
    "S0131": ("Vidhana Soudha", [77.5915, 12.9795], "central"),
    "S0132": ("Chinnaswamy Stadium", [77.5985, 12.9785], "central"),
    "S0133": ("MG Road Metro", [77.6065, 12.9755], "central"),
    "S0134": ("Ulsoor Lake", [77.6200, 12.9815], "central"),
    "S0135": ("CMH Road Indiranagar", [77.6380, 12.9790], "east"),
    "S0136": ("Indiranagar 100ft Road", [77.6435, 12.9715], "east"),
    "S0137": ("Swami Vivekananda Road Metro", [77.6485, 12.9845], "east"),
    "S0138": ("Benniganahalli", [77.6695, 12.9960], "east"),
}

# 40 Base routes mapped to sequences of Stop IDs (at least 15 stops per route!)
BASE_ROUTES_STOPS = {
    "335E": ["S0001", "S0021", "S0022", "S0023", "S0030", "S0031", "S0032", "S0033", "S0034", "S0035", "S0036", "S0011", "S0037", "S0038", "S0039", "S0040", "S0041", "S0042", "S0003"],
    "500A": ["S0001", "S0021", "S0074", "S0075", "S0077", "S0076", "S0078", "S0080", "S0081", "S0082", "S0083", "S0009", "S0084", "S0085", "S0087", "S0012"],
    "201": ["S0020", "S0115", "S0114", "S0113", "S0001", "S0021", "S0025", "S0093", "S0092", "S0091", "S0095", "S0096", "S0065", "S0002", "S0066", "S0067", "S0068", "S0069", "S0070", "S0071", "S0072", "S0004"],
    "356": ["S0001", "S0021", "S0025", "S0093", "S0091", "S0094", "S0095", "S0006", "S0065", "S0002", "S0063", "S0062", "S0058", "S0059", "S0060", "S0011", "S0037", "S0044", "S0005"],
    "314": ["S0001", "S0021", "S0022", "S0024", "S0026", "S0027", "S0094", "S0091", "S0095", "S0096", "S0097", "S0065", "S0002", "S0090", "S0006"],
    "KBS-7": ["S0001", "S0113", "S0114", "S0120", "S0121", "S0122", "S0123", "S0124", "S0008", "S0125", "S0126", "S0127", "S0128", "S0129", "S0130", "S0007"],
    "401": ["S0008", "S0046", "S0047", "S0048", "S0049", "S0050", "S0051", "S0052", "S0053", "S0055", "S0056", "S0057", "S0011", "S0060", "S0059", "S0058", "S0061", "S0062", "S0063", "S0064", "S0002"],
    "500C": ["S0001", "S0021", "S0074", "S0075", "S0077", "S0076", "S0078", "S0079", "S0080", "S0081", "S0082", "S0083", "S0009", "S0084", "S0089", "S0018"],
    "600": ["S0001", "S0021", "S0025", "S0093", "S0092", "S0091", "S0094", "S0095", "S0065", "S0002", "S0066", "S0067", "S0068", "S0069", "S0070", "S0071", "S0072", "S0073", "S0004"],
    "171": ["S0001", "S0131", "S0132", "S0133", "S0028", "S0029", "S0134", "S0135", "S0015", "S0137", "S0138", "S0053", "S0054", "S0055", "S0010"],
    "365": ["S0001", "S0021", "S0022", "S0023", "S0028", "S0030", "S0031", "S0032", "S0033", "S0034", "S0035", "S0036", "S0011", "S0057", "S0056", "S0055"],
    "252": ["S0020", "S0116", "S0115", "S0114", "S0113", "S0001", "S0021", "S0025", "S0093", "S0091", "S0095", "S0096", "S0006", "S0065", "S0002"],
    "270": ["S0012", "S0087", "S0085", "S0083", "S0009", "S0082", "S0076", "S0074", "S0021", "S0001", "S0113", "S0114", "S0120", "S0121", "S0122", "S0123", "S0124", "S0008"],
    "305E": ["S0001", "S0021", "S0025", "S0093", "S0091", "S0094", "S0095", "S0096", "S0006", "S0065", "S0002", "S0064", "S0063", "S0098", "S0099", "S0013"],
    "410": ["S0014", "S0118", "S0117", "S0020", "S0112", "S0111", "S0017", "S0101", "S0103", "S0016", "S0104", "S0105", "S0106", "S0107", "S0108", "S0109", "S0012", "S0087", "S0088", "S0089", "S0090", "S0018", "S0065", "S0002"],
    "340": ["S0001", "S0131", "S0132", "S0133", "S0028", "S0029", "S0134", "S0135", "S0136", "S0015", "S0137", "S0031", "S0030", "S0024", "S0022", "S0021"],
    "210": ["S0016", "S0104", "S0103", "S0102", "S0101", "S0100", "S0113", "S0114", "S0115", "S0020", "S0112", "S0111", "S0017", "S0001", "S0021"],
    "290": ["S0017", "S0111", "S0112", "S0114", "S0113", "S0001", "S0021", "S0074", "S0076", "S0080", "S0081", "S0082", "S0009", "S0084", "S0089", "S0090", "S0018"],
    "411": ["S0007", "S0130", "S0129", "S0128", "S0127", "S0126", "S0125", "S0008", "S0046", "S0047", "S0048", "S0049", "S0050", "S0051", "S0052", "S0053", "S0054", "S0010"],
    "500D": ["S0008", "S0046", "S0047", "S0048", "S0049", "S0051", "S0053", "S0054", "S0010", "S0055", "S0056", "S0057", "S0011", "S0060", "S0059", "S0058", "S0061", "S0062", "S0063", "S0002"],
    "501": ["S0019", "S0079", "S0078", "S0076", "S0077", "S0075", "S0074", "S0021", "S0001", "S0113", "S0114", "S0120", "S0121", "S0122", "S0123", "S0124", "S0008"],
    "330": ["S0001", "S0021", "S0025", "S0093", "S0092", "S0091", "S0094", "S0095", "S0096", "S0006", "S0065", "S0002", "S0064", "S0063", "S0098", "S0013"],
    "450": ["S0008", "S0046", "S0047", "S0049", "S0051", "S0053", "S0055", "S0011", "S0060", "S0058", "S0062", "S0002", "S0066", "S0067", "S0068", "S0069", "S0070", "S0071", "S0004"],
    "116": ["S0020", "S0116", "S0112", "S0111", "S0017", "S0101", "S0103", "S0016", "S0110", "S0104", "S0105", "S0106", "S0107", "S0108", "S0109", "S0085", "S0012"],
    "225": ["S0014", "S0118", "S0117", "S0020", "S0115", "S0114", "S0113", "S0001", "S0021", "S0025", "S0093", "S0091", "S0095", "S0096", "S0006"],
    "500E": ["S0001", "S0113", "S0100", "S0101", "S0102", "S0103", "S0016", "S0104", "S0110", "S0105", "S0106", "S0107", "S0108", "S0109", "S0012", "S0086"],
    "285": ["S0020", "S0115", "S0114", "S0113", "S0001", "S0021", "S0022", "S0025", "S0093", "S0092", "S0091", "S0095", "S0065", "S0002", "S0089", "S0018"],
    "500F": ["S0001", "S0021", "S0074", "S0076", "S0078", "S0080", "S0082", "S0083", "S0009", "S0084", "S0085", "S0086", "S0087", "S0088", "S0089", "S0012"],
    "310": ["S0015", "S0136", "S0135", "S0031", "S0030", "S0032", "S0033", "S0034", "S0035", "S0036", "S0011", "S0057", "S0056", "S0055", "S0053", "S0010"],
    "370": ["S0001", "S0021", "S0022", "S0023", "S0030", "S0031", "S0032", "S0034", "S0036", "S0011", "S0037", "S0038", "S0039", "S0040", "S0044", "S0045", "S0005"],
    "550": ["S0019", "S0079", "S0082", "S0009", "S0084", "S0089", "S0090", "S0018", "S0065", "S0002", "S0066", "S0067", "S0068", "S0069", "S0070", "S0071", "S0004"],
    "177": ["S0001", "S0021", "S0022", "S0023", "S0031", "S0032", "S0033", "S0034", "S0035", "S0036", "S0011", "S0037", "S0038", "S0039", "S0040", "S0041", "S0042", "S0043", "S0003"],
    "350": ["S0001", "S0021", "S0022", "S0023", "S0028", "S0030", "S0031", "S0032", "S0034", "S0036", "S0011", "S0037", "S0038", "S0044", "S0045", "S0005"],
    "KIAS-7": ["S0001", "S0113", "S0120", "S0121", "S0122", "S0123", "S0124", "S0008", "S0125", "S0126", "S0127", "S0128", "S0129", "S0130", "S0007"],
    "155": ["S0012", "S0087", "S0088", "S0089", "S0090", "S0018", "S0065", "S0002", "S0063", "S0062", "S0058", "S0060", "S0011", "S0055", "S0053", "S0054", "S0010"],
    "500G": ["S0001", "S0100", "S0101", "S0102", "S0103", "S0016", "S0104", "S0110", "S0105", "S0106", "S0107", "S0108", "S0109", "S0012", "S0085", "S0086"],
    "502": ["S0016", "S0104", "S0110", "S0105", "S0106", "S0107", "S0108", "S0109", "S0085", "S0087", "S0012", "S0088", "S0089", "S0090", "S0018", "S0002"],
    "375": ["S0002", "S0063", "S0062", "S0058", "S0059", "S0060", "S0011", "S0037", "S0038", "S0039", "S0040", "S0041", "S0042", "S0044", "S0045", "S0005"],
    "500H": ["S0001", "S0021", "S0074", "S0075", "S0077", "S0076", "S0078", "S0079", "S0019", "S0082", "S0083", "S0009", "S0084", "S0089", "S0018", "S0065"],
    "343": ["S0008", "S0124", "S0123", "S0122", "S0121", "S0114", "S0113", "S0001", "S0021", "S0074", "S0076", "S0080", "S0082", "S0083", "S0009", "S0085", "S0012"]
}

# Verify every route has >= 15 stops
for r_no, s_list in BASE_ROUTES_STOPS.items():
    if len(s_list) < 15:
        print(f"Warning: {r_no} has {len(s_list)} stops (needs >= 15)")

# Load original routes to preserve route metadata (type, routeNo, origin, destination)
with open('data/routes.json') as f:
    orig_routes = json.load(f)

route_meta = {}
for r in orig_routes:
    r_no = r['routeNo']
    if r_no not in route_meta:
        route_meta[r_no] = {
            'type': r['type'],
            'origin': r['origin'],
            'destination': r['destination']
        }

# Generate 80 routes (40 UP, 40 DN)
new_routes = []
stop_routes_map = {sid: set() for sid in MASTER_STOPS}

for r_no, stop_ids in BASE_ROUTES_STOPS.items():
    meta = route_meta[r_no]
    
    # UP direction (first stop to last stop)
    r_id_up = f"{r_no}-UP"
    coords_up = [MASTER_STOPS[sid][1] for sid in stop_ids]
    
    # Compute cumulative offsets
    offsets_up = [0]
    total_m_up = 0
    for i in range(1, len(coords_up)):
        p1 = coords_up[i-1]
        p2 = coords_up[i]
        d = max(100, int(haversine(p1[0], p1[1], p2[0], p2[1]) * 1.25))  # road factor 1.25, min 100m
        total_m_up += d
        offsets_up.append(total_m_up)
    
    stops_up = []
    for idx, sid in enumerate(stop_ids):
        stops_up.append({
            "stopId": sid,
            "offsetM": offsets_up[idx],
            "seqNo": idx + 1
        })
        stop_routes_map[sid].add(r_id_up)
    
    route_up = {
        "_id": r_id_up,
        "routeNo": r_no,
        "direction": "UP",
        "origin": MASTER_STOPS[stop_ids[0]][0],
        "destination": MASTER_STOPS[stop_ids[-1]][0],
        "type": meta['type'],
        "lengthM": total_m_up + 50,
        "geometry": {
            "type": "LineString",
            "coordinates": coords_up
        },
        "stops": stops_up
    }
    new_routes.append(route_up)

    # DN direction (reverse order)
    r_id_dn = f"{r_no}-DN"
    stop_ids_dn = list(reversed(stop_ids))
    coords_dn = [MASTER_STOPS[sid][1] for sid in stop_ids_dn]
    
    offsets_dn = [0]
    total_m_dn = 0
    for i in range(1, len(coords_dn)):
        p1 = coords_dn[i-1]
        p2 = coords_dn[i]
        d = max(100, int(haversine(p1[0], p1[1], p2[0], p2[1]) * 1.25))
        total_m_dn += d
        offsets_dn.append(total_m_dn)
    
    stops_dn = []
    for idx, sid in enumerate(stop_ids_dn):
        stops_dn.append({
            "stopId": sid,
            "offsetM": offsets_dn[idx],
            "seqNo": idx + 1
        })
        stop_routes_map[sid].add(r_id_dn)
    
    route_dn = {
        "_id": r_id_dn,
        "routeNo": r_no,
        "direction": "DN",
        "origin": MASTER_STOPS[stop_ids_dn[0]][0],
        "destination": MASTER_STOPS[stop_ids_dn[-1]][0],
        "type": meta['type'],
        "lengthM": total_m_dn + 50,
        "geometry": {
            "type": "LineString",
            "coordinates": coords_dn
        },
        "stops": stops_dn
    }
    new_routes.append(route_dn)

# Generate stops list with routeIds populated
new_stops = []
for sid, (sname, scoords, szone) in sorted(MASTER_STOPS.items()):
    new_stops.append({
        "_id": sid,
        "name": sname,
        "loc": {
            "type": "Point",
            "coordinates": scoords
        },
        "routeIds": sorted(list(stop_routes_map[sid])),
        "zone": szone
    })

print(f"Generated {len(new_stops)} clean stops and {len(new_routes)} routes.")

# Save to data/
with open('data/stops.json', 'w') as f:
    json.dump(new_stops, f, indent=2)
with open('data/routes.json', 'w') as f:
    json.dump(new_routes, f, indent=2)

# Copy to client/public/data/ and simulator/tests/fixtures/
with open('client/public/data/stops.json', 'w') as f:
    json.dump(new_stops, f, indent=2)
with open('client/public/data/routes.json', 'w') as f:
    json.dump(new_routes, f, indent=2)
with open('simulator/tests/fixtures/routes.json', 'w') as f:
    json.dump(new_routes, f, indent=2)

print("Saved files to data/, client/public/data/, and simulator fixtures.")
