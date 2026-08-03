{{/*
Optional billing / AI secret env vars for API (and worker where noted).
Keys must exist in values.existingSecret — see deploy/k8s/818cloud/README.md
*/}}
{{- define "fde-platform.apiExtraEnv" -}}
{{- if .Values.wechatPay.enabled }}
- name: WECHAT_PAY_MCH_ID
  valueFrom:
    secretKeyRef:
      name: {{ include "fde-platform.secretName" . }}
      key: WECHAT_PAY_MCH_ID
      optional: true
- name: WECHAT_PAY_APP_ID
  valueFrom:
    secretKeyRef:
      name: {{ include "fde-platform.secretName" . }}
      key: WECHAT_PAY_APP_ID
      optional: true
- name: WECHAT_PAY_SERIAL_NO
  valueFrom:
    secretKeyRef:
      name: {{ include "fde-platform.secretName" . }}
      key: WECHAT_PAY_SERIAL_NO
      optional: true
- name: WECHAT_PAY_API_V3_KEY
  valueFrom:
    secretKeyRef:
      name: {{ include "fde-platform.secretName" . }}
      key: WECHAT_PAY_API_V3_KEY
      optional: true
{{- if .Values.wechatPay.mountCerts }}
- name: WECHAT_PAY_PRIVATE_KEY_PATH
  value: /secrets/wechat/apiclient_key.pem
- name: WECHAT_PAY_PLATFORM_CERT_PATH
  value: /secrets/wechat/wechatpay_platform.pem
{{- else }}
- name: WECHAT_PAY_PRIVATE_KEY_PATH
  valueFrom:
    secretKeyRef:
      name: {{ include "fde-platform.secretName" . }}
      key: WECHAT_PAY_PRIVATE_KEY_PATH
      optional: true
- name: WECHAT_PAY_PLATFORM_CERT_PATH
  valueFrom:
    secretKeyRef:
      name: {{ include "fde-platform.secretName" . }}
      key: WECHAT_PAY_PLATFORM_CERT_PATH
      optional: true
{{- end }}
{{- end }}
- name: DEEPSEEK_API_KEY
  valueFrom:
    secretKeyRef:
      name: {{ include "fde-platform.secretName" . }}
      key: DEEPSEEK_API_KEY
      optional: true
{{- end }}

{{- define "fde-platform.apiExtraVolumeMounts" -}}
{{- if and .Values.wechatPay.enabled .Values.wechatPay.mountCerts }}
- name: wechat-certs
  mountPath: /secrets/wechat
  readOnly: true
{{- end }}
{{- end }}

{{- define "fde-platform.apiExtraVolumes" -}}
{{- if and .Values.wechatPay.enabled .Values.wechatPay.mountCerts }}
- name: wechat-certs
  secret:
    secretName: {{ include "fde-platform.secretName" . }}
    items:
      - key: {{ .Values.wechatPay.privateKeySecretKey }}
        path: apiclient_key.pem
      - key: {{ .Values.wechatPay.platformCertSecretKey }}
        path: wechatpay_platform.pem
{{- end }}
{{- end }}
