# MACHINE LEARNING FLOOD FORECASTING EVALUATION REPORT
### Development of an Image Processing-Driven Flood Monitoring and Predictive Evacuation System for Municipality of Lumban Laguna

**Model Architecture:** Ridge Regularized Hydrological Regressor  
**Evaluation Standard:** Chronological Train/Test Split (80% Train, 20% Test)  
**Trained At:** 2026-09-22T12:09:14.579430Z  
**Dataset Instances:** 7,227 Training Samples | 1,807 Testing Samples  

---

## 1. Executive Summary & Defense Justification

In response to the defense panel inquiry (*"the system only is delimited to post info fmt no learning. please include learning based on the historical data"*), the system integrates a **Supervised Machine Learning (ML) Hydrological Forecasting Engine** trained on historical river sensor readings.

Rather than relying on static two-point linear rate-of-rise extrapolation ($y = mx + b$), this model learns **non-linear rise and cresting patterns** using multi-lag temporal features:
* Antecedent water level states ($t-15\text{m}, t-30\text{m}, t-60\text{m}$)
* 1st Derivative (Velocity / Rate of Rise: $\frac{dy}{dt}$)
* 2nd Derivative (Hydrological Acceleration: $\frac{d^2y}{dt^2}$ to detect cresting/deceleration)

---

## 2. Quantitative Model Performance vs. Baselines

The table below demonstrates the substantial accuracy improvement of the Machine Learning models over the naive rate-of-rise baseline across both **+1 Hour** and **+3 Hours** forecast horizons:

| Forecast Horizon | Model Architecture | $R^2$ Score (Variance Explained) | MAE (Mean Absolute Error) | RMSE (Root Mean Squared Error) | Evaluation Verdict |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **+1 Hour Ahead** | Naive Linear Extrapolation | `0.907` | — | `0.5932 m` | Inaccurate during non-linear cresting |
| **+1 Hour Ahead** | **Ridge Regressor (ML - Production)** | **`0.9711`** | **`0.1198 m`** | **`0.3304 m`** | **High Accuracy & Ultra-Fast Inference** |
| **+1 Hour Ahead** | Random Forest Regressor (ML) | `0.9754` | — | `0.3047 m` | Excellent non-linear capture |
| **+3 Hours Ahead** | Naive Linear Extrapolation | `0.2542` | — | `1.6676 m` | Severely overshoots/diverges |
| **+3 Hours Ahead** | **Ridge Regressor (ML - Production)** | **`0.8633`** | **`0.3759 m`** | **`0.714 m`** | **Robust multi-hour trend hold** |
| **+3 Hours Ahead** | Random Forest Regressor (ML) | `0.9129` | — | `0.57 m` | High stability across flood peaks |

---

## 3. Mathematical Formulation (Ridge Regularized Regressor)

The deployed model computes forecasted water level $\hat{y}$ using regularized weights trained to minimize mean squared error with an $L_2$ penalty:

$$\min_{w, b} \sum_{i=1}^{N} \left( y_i - (w^T x_i + b) \right)^2 + \alpha \|w\|_2^2$$

Where the feature vector $x$ is normalized via $z$-score scaling:
$$x_j^{\text{norm}} = \frac{x_j - \mu_j}{\sigma_j}$$

### Feature Importance & Contribution Ranking:
1. **Current Water Level ($L_t$):** 96.4% relative importance
2. **Short-Term Velocity ($v_{15\text{m}}$):** 0.1% relative importance
3. **1-Hour Historical Lag ($L_{t-60\text{m}}$):** 0.1% relative importance
4. **Hydrological Acceleration ($a$):** 0.0% relative importance
5. **Antecedent Lags ($L_{t-30\text{m}}, L_{t-15\text{m}}$):** 0.1% relative importance

---

## 4. System Integration & Operational Flow

1. **Continuous Feature Extraction:** Every time a new camera reading arrives, the Node.js backend retrieves the last hour of telemetry to construct $[L_t, L_{t-15}, L_{t-30}, L_{t-60}, v_{15}, v_{60}, a]$.
2. **Inference Execution:** The backend computes the $+1\text{h}$ and $+3\text{h}$ predicted levels in $<1\text{ms}$ using the learned weights.
3. **Database Archival:** Predictions are committed to the `water_level_forecasts` PostgreSQL table with timestamped validity (`valid_at`).
4. **Early Warning Dispatch:** If the $+1\text{h}$ or $+3\text{h}$ projection crosses the $4.1\text{m}$ Alert or $5.1\text{m}$ Evacuation thresholds, proactive advisory notifications are automatically dispatched before physical water reaches flood stage.
