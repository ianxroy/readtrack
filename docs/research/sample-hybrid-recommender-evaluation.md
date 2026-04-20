## Table 16. Test Scenarios

| Test Number | Scenario Description | Expectation |
|---|---|---|
| 1 | A coffee study date during clear and sunny weather. | Casual outfit such as a light t-shirt or blouse, jeans or a skirt, and comfortable shoes. |
| 2 | Shopping at a local market during light rainfall. | Casual outfit with comfortable pants and weather-appropriate footwear. |
| 3 | Morning jog in a residential neighborhood. | Sportswear such as jogging pants or shorts, and running shoes. |
| 4 | Beach outing. | Summer outfit such as a sleeveless top or light shirt, shorts, skirts, and slippers or sandals. Sunglasses or a hat may be worn. |
| 5 | Birthday celebration with a red theme. | A red shirt, blouse, or dress paired with black pants, skirt, or jeans and stylish shoes. |
| 6 | Picnic with friends at the park. | Comfortable casual outfit such as a t-shirt, blouse, or dress, shorts, skirts, or jeans, and sneakers or sandals. |
| 7 | Attending a formal Sunday church service. | Formal or semi-formal outfit such as a dress, polo, or button-down shirt paired with slacks or a skirt and closed shoes. |
| 8 | Office presentation in an air-conditioned venue. | Smart casual to semi-formal outfit, preferably layered (e.g., blazer or cardigan) with polished shoes. |
| 9 | Evening dinner date on a rooftop restaurant. | Stylish semi-formal outfit with coordinated colors, appropriate accessories, and comfortable evening footwear. |
| 10 | School event during a cloudy and drizzly afternoon. | Neat casual outfit with light outerwear and closed shoes to handle cool, damp weather. |

## Table 17. F1 Score Result for Male User

| Test No. | TP | FP | FN | Precision (TP / (TP + FP)) | Recall (TP / (TP + FN)) | F1 Score (%) (2 * precision * recall / (precision + recall)) |
|---|---:|---:|---:|---:|---:|---:|
| 1 | 5 | 0 | 0 | 1.0000 | 1.0000 | 100% |
| 2 | 5 | 0 | 0 | 1.0000 | 1.0000 | 100% |
| 3 | 5 | 0 | 0 | 1.0000 | 1.0000 | 100% |
| 4 | 3 | 2 | 0 | 0.6000 | 1.0000 | 75% |
| 5 | 4 | 1 | 0 | 0.8000 | 1.0000 | 88.89% |
| 6 | 5 | 0 | 0 | 1.0000 | 1.0000 | 100% |
| 7 | 4 | 1 | 0 | 0.8000 | 1.0000 | 88.89% |
| 8 | 5 | 0 | 0 | 1.0000 | 1.0000 | 100% |
| 9 | 5 | 0 | 0 | 1.0000 | 1.0000 | 100% |
| 10 | 5 | 0 | 0 | 1.0000 | 1.0000 | 100% |
| **Total** | **46** | **4** | **0** | **0.9200** | **1.0000** | **95.83%** |

## Table 18. F1 Score Result for Female User

| Test No. | TP | FP | FN | Precision (TP / (TP + FP)) | Recall (TP / (TP + FN)) | F1 Score (%) (2 * precision * recall / (precision + recall)) |
|---|---:|---:|---:|---:|---:|---:|
| 1 | 5 | 0 | 0 | 1.0000 | 1.0000 | 100% |
| 2 | 5 | 0 | 0 | 1.0000 | 1.0000 | 100% |
| 3 | 4 | 1 | 0 | 0.8000 | 1.0000 | 88.89% |
| 4 | 5 | 0 | 0 | 1.0000 | 1.0000 | 100% |
| 5 | 5 | 0 | 0 | 1.0000 | 1.0000 | 100% |
| 6 | 5 | 0 | 0 | 1.0000 | 1.0000 | 100% |
| 7 | 5 | 0 | 0 | 1.0000 | 1.0000 | 100% |
| 8 | 4 | 1 | 0 | 0.8000 | 1.0000 | 88.89% |
| 9 | 4 | 1 | 0 | 0.8000 | 1.0000 | 88.89% |
| 10 | 5 | 0 | 0 | 1.0000 | 1.0000 | 100% |
| **Total** | **47** | **3** | **0** | **0.9400** | **1.0000** | **96.91%** |

## Table 19. Overall F1 Score Result

| F1 Score Result | TP | FP | FN | Precision (TP / (TP + FP)) | Recall (TP / (TP + FN)) | F1 Score (%) (2 * precision * recall / (precision + recall)) |
|---|---:|---:|---:|---:|---:|---:|
| Male | 46 | 4 | 0 | 0.9200 | 1.0000 | 95.83% |
| Female | 47 | 3 | 0 | 0.9400 | 1.0000 | 96.91% |
| **Overall** | **93** | **7** | **0** | **0.9300** | **1.0000** | **96.37%** |

## Discussion of Results

Table 16 presents a curated set of ten test scenarios designed to thoroughly evaluate the recommendation capability of the Hybrid Recommender System (HRS), with specific focus on its Context-Aware Filtering (CAF), Content-Based Filtering (CBF), and Collaborative Filtering (CF) components. The scenarios were intentionally varied to cover different event types, environmental conditions, style preferences, and weather situations in order to ensure a comprehensive assessment of the system behavior.

The resulting scores demonstrate the system's capability to interpret practical and nuanced user requirements. In most scenarios, the recommended outfit combinations aligned with expected category labels and style constraints, while also maintaining contextual appropriateness (for example, adjusting for weather, occasion formality, and thematic color requirements). The model also showed consistency in retaining high recall across both male and female test sets.

As shown in Tables 17 and 18, both user groups achieved perfect recall (1.0000), indicating that relevant recommendations were consistently retrieved across all tests. Precision values remained high, with only a small number of false positives in selected scenarios. These minor mismatches are acceptable in recommendation contexts where diversity can still be useful to users.

Table 19 summarizes the overall performance of the system, yielding an aggregate precision of 0.9300, recall of 1.0000, and F1 score of 96.37%. These findings indicate that the HRS successfully integrates multiple data inputs and filtering strategies to deliver robust and context-sensitive outfit recommendations across varied user profiles and use cases.
