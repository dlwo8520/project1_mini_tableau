from django.shortcuts import render

# Create your views here.
# backend/upload/views.py
import pandas as pd
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .serializers import FileUploadSerializer

class FileUploadView(APIView):
    def post(self, request, format=None):
        serializer = FileUploadSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        uploaded_file = serializer.validated_data['file']
        # 확장자에 따라 읽기
        fname = uploaded_file.name.lower()
        try:
            if fname.endswith('.csv'):
                 df = pd.read_csv(uploaded_file)
                 last_exc = None
                 for enc in ('utf-8', 'utf-8-sig', 'utf-16'):
                    try:
                        # reset file pointer on each attempt
                        uploaded_file.seek(0)
                        df = pd.read_csv(uploaded_file, encoding=enc)
                        break
                    except Exception as e:
                        last_exc = e
                 else:
                    # if none worked, re-raise the last exception
                    raise last_exc

            elif fname.endswith(('.xls', '.xlsx')):
                df = pd.read_excel(uploaded_file, engine='openpyxl')
            else:
                return Response(
                    {'file': 'CSV 또는 Excel(.xls/.xlsx) 파일만 지원합니다.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        except Exception as e:
            return Response(
                {'file': f'파일 읽기 오류: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 변수명·타입 추출
        columns = [{'name': col, 'dtype': str(df[col].dtype)} for col in df.columns]

        return Response({
            'rows': len(df),
            'columns': columns,
            'data': df.to_dict(orient='records')   # ← 전체 로우를 객체 배열로 반환
        })
